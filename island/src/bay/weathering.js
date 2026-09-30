// Weathering: the marks weather, traffic and years leave. Streets wear dark down the wheel
// paths, crack, get patched and sealed, drip oil, fill their gutters with grime and
// leaves and their low spots with puddles; walls streak under the roof and the sills,
// splash dirty at the foot, bleach on the sunny side and go green on the damp north side;
// bare slopes gully, scree gathers under the rock, the drainages stay dark and wet; the
// fallen wood rots. All of it procedural (no textures: the Bay ground already draws its
// sixteen), fading to its average where it would be finer than a pixel, and a cheaper
// path on phones. How old a building is comes from what it is and where it stands, never
// from who lives there.

const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const WX_DEFS = PHONE ? '#define WX_LITE\n' : '';

// shared helpers; they need vn and h21 (NOISE_GLSL) before them
export const WX_GLSL = /* glsl */`
float wxPud = 0.0, wxPudA = 0.0, wxGloss = 0.0, wxBump = 0.0, wxDamp = 0.0;
// a thin line along a noise's middle contour, antialiased; faded to nothing where it would
// be finer than a pixel (half-width wd in the noise's own units)
float wxLine(float n, float wd){
	float fw = max(fwidth(n), 1e-5);
	return (1.0 - smoothstep(wd, wd + fw * 1.2, abs(n - 0.5))) * (1.0 - smoothstep(wd * 1.5, wd * 5.0, fw));
}
// a scatter of round spots, one chance per cell of size s: radius r, chance k
float wxSpots(vec2 p, float s, float r, float k){
	vec2 c = floor(p / s), f = p / s - c - 0.5;
	float h = h21(c + 13.7);
	vec2 o = (vec2(h21(c + 3.1), h21(c + 9.4)) - 0.5) * (1.0 - 2.0 * r / s);
	float d = length(f - o) * s, aa = max(fwidth(p.x), 1e-4) * 1.2;
	return step(1.0 - k, h) * (1.0 - smoothstep(r - aa, r + aa, d));
}
`;

// ---------- streets ----------
// asphalt given its years. w: ground (m); ld: metres to the nearest lane's centre, lk: in a
// lane at all; pat: in a patch, cov: a utility cover; px: metres a pixel covers
export const STREET_GLSL = /* glsl */`
vec3 asphaltAge(vec3 c, vec2 w, float ld, float lk, float pat, float cov, float px, float gut){
	vec2 wl = mod(w, 1024.0);
	float mid = 1.0 - smoothstep(0.1, 0.4, px);
	// this stretch's age: some resurfaced fresh and black, most greyed by sun and years
	float age = vn(w * 0.011 + 3.1) * 0.75 + vn(w * 0.07) * 0.25;
	c = mix(c, vec3(0.07, 0.07, 0.075), (1.0 - smoothstep(0.2, 0.32, age)) * 0.85);
	c = mix(c, c * vec3(1.14, 1.13, 1.1), smoothstep(0.5, 0.85, age) * 0.5);
	// the wheel paths: rubber-dark and polished smooth
	float tr = lk * exp(-(ld - 0.85) * (ld - 0.85) * 10.0);
	c *= 1.0 - 0.22 * tr;
	wxGloss = tr * 0.3;
	// oil dripped down the lane's middle
	float oil = lk * (1.0 - smoothstep(0.2, 0.55, ld)) * (smoothstep(0.55, 0.85, vn(w * 0.45)) * 0.35 + wxSpots(wl, 0.45, 0.07, 0.3) * (1.0 - smoothstep(0.03, 0.08, px)) * 0.65);
	c = mix(c, vec3(0.05, 0.05, 0.055), oil * 0.55);
	wxGloss += oil * 0.25;
	#ifndef WX_LITE
	if (mid > 0.0) {
		// long meandering cracks on the old stretches; alligator cracking in their wheel paths
		// (in runs with gaps between, never one line wandering on forever)
		float crk = wxLine(vn(w * 0.9 + 7.0), 0.006) * smoothstep(0.42, 0.7, age) * smoothstep(0.35, 0.65, vn(w * 0.07 + 3.0));
		float gt = smoothstep(0.55, 0.8, age + vn(w * 0.2) * 0.3) * smoothstep(0.2, 0.6, tr);
		if (gt > 0.0) crk = max(crk, max(wxLine(vn(wl * 4.0 + 1.3), 0.01), wxLine(vn(wl * 4.0 + 17.7), 0.01)) * gt * 0.5);
		c = mix(c, c * 0.72, crk * mid * (1.0 - pat));
		// the black tar snakes where a crew sealed them
		float snake = wxLine(vn(w * 0.35 + 2.0), 0.007) * smoothstep(0.6, 0.7, vn(w * 0.02 + 9.0)) * mid * (1.0 - pat);
		c = mix(c, vec3(0.03, 0.03, 0.033), snake * 0.6);
		wxGloss += snake * 0.5;
		// ravelled aggregate: the pale stone showing through on the oldest
		c = mix(c, vec3(0.34, 0.33, 0.31), step(0.9, h21(floor(wl * 20.0))) * smoothstep(0.6, 0.9, age) * (1.0 - smoothstep(0.02, 0.05, px)) * 0.5);
	}
	#endif
	// a patch: its own age, darker or greyer, a sealed seam round it
	vec3 patC = mix(vec3(0.075, 0.075, 0.08), vec3(0.2, 0.2, 0.205), vn(floor(w / 3.0) * 0.37));
	c = mix(c, patC * (0.9 + 0.2 * vn(w * 0.8)), pat);
	// a utility cover: cast iron in a raised grid, rust at the rim
	vec2 ck = step(0.5, fract(wl * 8.0));
	vec3 ironC = vec3(0.12, 0.115, 0.11) * mix(1.0, 0.75 + 0.5 * abs(ck.x - ck.y), 1.0 - smoothstep(0.02, 0.05, px));
	c = mix(c, mix(ironC, vec3(0.2, 0.1, 0.05), smoothstep(0.55, 0.8, vn(wl * 12.0)) * 0.6), cov);
	wxGloss += cov * 0.4;
	// after rain, puddles in the low spots: the ruts, the dips, along the gutter
	float low = vn(w * 0.16 + 1.3) * 0.7 + vn(w * 0.7) * 0.3 + tr * 0.12 + gut * 0.18 - pat * 0.1;
	wxPudA = smoothstep(0.82 - uWet * 0.3, 0.86 - uWet * 0.3, low) * smoothstep(0.05, 0.3, uWet);
	return c;
}
// the gutter's grime and litter, dead leaves drifted in autumn; g: 0..1 across the gutter
// band (1 against the kerb)
vec3 gutterAge(vec3 c, vec2 w, float g, float px){
	vec2 wl = mod(w, 1024.0);
	float fine = 1.0 - smoothstep(0.02, 0.06, px);
	c = mix(c, c * vec3(0.72, 0.66, 0.58), g * 0.6);
	float lit = step(0.97, h21(floor(wl * 12.0))) * g * fine;
	c = mix(c, mix(vec3(0.75, 0.73, 0.68), vec3(0.45, 0.3, 0.18), h21(floor(wl * 12.0) + 5.0)), lit * 0.8);
	float leaf = uLeafFall * g * smoothstep(0.35, 0.7, vn(w * 0.9) * 0.7 + vn(w * 0.1) * 0.3);
	vec3 leafC = mix(vec3(0.42, 0.2, 0.06), vec3(0.55, 0.4, 0.1), h21(floor(wl * 16.0)));
	c = mix(c, mix(vec3(0.3, 0.2, 0.1), leafC, fine), leaf * (0.55 + 0.45 * fine * step(0.35, h21(floor(wl * 16.0) + 2.0))));
	return c;
}
// a sidewalk's years: stains, cracks, gum, a slab heaved up by a tree's roots, weeds in
// the seams (seam: 0..1 how near a joint or edge)
vec3 walkAge(vec3 c, vec2 w, float px, float seam){
	vec2 wl = mod(w, 1024.0);
	float fine = 1.0 - smoothstep(0.02, 0.06, px), mid = 1.0 - smoothstep(0.08, 0.3, px);
	c *= 0.86 + 0.2 * vn(w * 0.35) + 0.06 * vn(wl * 4.0);
	c = mix(c, c * vec3(0.8, 0.78, 0.74), smoothstep(0.6, 0.85, vn(w * 0.12 + 4.0)) * 0.5);
	float heave = smoothstep(0.72, 0.86, vn(w * 0.09 + 11.0));
	#ifndef WX_LITE
	c = mix(c, c * 0.55, wxLine(vn(w * 0.8 + 3.0), 0.01) * (0.4 + heave) * mid);
	c = mix(c, vec3(0.2, 0.2, 0.19), wxSpots(wl, 0.33, 0.018, 0.12) * fine);
	#endif
	wxBump += heave * 0.05 * vn(w * 0.6);
	float weed = seam * smoothstep(0.5, 0.75, vn(w * 1.3)) * mix(0.4, step(0.55, h21(floor(wl * 24.0))), fine);
	c = mix(c, mix(vec3(0.12, 0.2, 0.05), vec3(0.3, 0.28, 0.1), uSeason), weed * 0.85);
	return c;
}
`;

// ---------- walls ----------
// w: world point, n: world normal, y: metres above the ground, H: the wall's height,
// e: metres to the wall's nearest corner, age: 0 new .. 1 old and let go, px: metres a pixel,
// conc: 0 painted .. 1 bare concrete or stone
export const WALL_GLSL = /* glsl */`
float wxH(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wxN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wxH(i), wxH(i + vec2(1, 0)), f.x), mix(wxH(i + vec2(0, 1)), wxH(i + vec2(1, 1)), f.x), f.y); }
vec3 wallAge(vec3 c, vec3 w, vec3 n, float y, float H, float e, float age, float px, float conc){
	float mid = 1.0 - smoothstep(0.15, 0.6, px);
	float u = mod(dot(w.xz, vec2(-n.z, n.x)), 1000.0);
	float fog = 1.0 - smoothstep(22000.0, 58000.0, w.x);
	float north = clamp(-n.z, 0.0, 1.0), south = clamp(n.z, 0.0, 1.0);
	// sun-bleached on the south faces, the colour chalked out of the paint
	float lum = dot(c, vec3(0.3, 0.55, 0.15));
	c = mix(c, vec3(lum) * 1.08 + 0.03, south * (0.08 + 0.2 * age) * (1.0 - conc * 0.5));
	// rain streaks: down from the roof's edge and from under each floor's sills
	float col = wxN(vec2(u * 1.7, 0.5)) * 0.6 + wxN(vec2(u * 5.3, y * 0.15)) * 0.4;
	float fromTop = exp(-max(H - y, 0.0) / (0.8 + 2.5 * age));
	float fl = fract((y - 1.9) / 3.3);
	float fromSill = (1.0 - smoothstep(0.0, 0.55 + age * 0.4, 1.0 - fl)) * step(2.5, y) * step(0.5, wxH(vec2(floor(u / 1.3), floor((y - 1.9) / 3.3))));
	float streak = smoothstep(0.45, 0.8, col) * max(fromTop, fromSill * 0.8) * mix(0.5, 1.0, mid);
	c = mix(c, c * mix(vec3(0.62, 0.62, 0.6), vec3(0.55, 0.57, 0.5), fog), streak * (0.25 + 0.5 * age));
	// splash-back: dirt up the foot of the wall, higher on the old ones
	float foot = 1.0 - smoothstep(0.0, 0.35 + 0.8 * age, y + (wxN(vec2(u * 1.1, 3.0)) - 0.5) * 0.3);
	c = mix(c, c * vec3(0.6, 0.55, 0.48), foot * (0.3 + 0.45 * age));
	// the corners and the angles hold grime
	c *= 1.0 - (1.0 - smoothstep(0.0, 0.6, e)) * (0.12 + 0.2 * age);
	// on bare concrete, pale efflorescence and dark water stains; on paint, peeling to the grey
	// undercoat on the neglected
	float stain = smoothstep(0.55, 0.8, wxN(vec2(u * 0.6, y * 0.35) + 7.0)) * conc;
	c = mix(c, c * vec3(0.78, 0.8, 0.78), stain * 0.4 * (0.4 + age));
	c = mix(c, vec3(0.8, 0.79, 0.74), smoothstep(0.7, 0.85, wxN(vec2(u * 2.1, y * 1.3) + 1.0)) * (1.0 - smoothstep(0.3, 1.8, y)) * conc * age * 0.5);
	float peel = smoothstep(0.8 - 0.12 * age, 0.83 - 0.12 * age, wxN(vec2(u * 2.5, y * 2.5)) * 0.6 + wxN(vec2(u * 9.0, y * 9.0)) * 0.4) * smoothstep(0.6, 0.9, age) * (1.0 - conc) * mid;
	c = mix(c, mix(c * 0.85 + 0.08, vec3(0.5, 0.48, 0.45), step(0.6, wxN(vec2(u * 3.0, y * 3.0)))), peel * 0.5);
	// rust bleeding down from a fixture: a bracket, a pipe, a vent now and then
	float rc = floor(u / 2.7), ry = 2.0 + wxH(vec2(rc, 5.0)) * max(H - 3.0, 0.5);
	float rx = abs(u - (rc + 0.5) * 2.7 - (wxH(vec2(rc, 9.0)) - 0.5) * 1.6);
	float rust = step(0.72 - age * 0.2, wxH(vec2(rc, 2.0))) * (1.0 - smoothstep(0.03, 0.08 + 0.06 * (ry - y), rx)) * step(y, ry) * exp(-(ry - y) * 0.6) * mid;
	c = mix(c, vec3(0.36, 0.17, 0.07), rust * 0.6);
	// the damp: green algae and moss on the shady north side in the fog belt, low down and up
	// under the eaves; pale lichen crusts
	float damp = north * (0.3 + 0.7 * fog) * smoothstep(0.3, 0.9, age) * max(1.0 - smoothstep(0.0, 0.8 + age, y), fromTop * 0.5);
	float greenK = damp * smoothstep(0.45, 0.75, wxN(vec2(u * 2.3, y * 1.6) + 4.0));
	c = mix(c, c * vec3(0.55, 0.68, 0.45), greenK * 0.6);
	c = mix(c, c * 0.8 + vec3(0.1, 0.11, 0.08), smoothstep(0.78, 0.84, wxN(vec2(u * 4.0, y * 4.0) + 9.0)) * age * fog * mid * 0.4);
	return c;
}
// a roof's years: dark streaks of algae down the north slopes, moss in the fog belt, dust
vec3 roofAge(vec3 c, vec3 w, vec3 n, float age){
	float fog = 1.0 - smoothstep(22000.0, 58000.0, w.x);
	float north = clamp(-n.z * 3.0, 0.0, 1.0);
	c = mix(c, c * 0.7, smoothstep(0.4, 0.8, wxN(vec2(mod(dot(w.xz, vec2(-n.z, n.x)), 1000.0) * 1.5, 0.5))) * (0.2 + 0.5 * age) * (0.4 + 0.6 * north));
	c = mix(c, vec3(0.12, 0.16, 0.06), smoothstep(0.55, 0.75, wxN(mod(w.xz, 1000.0) * 0.8)) * north * fog * age * 0.7);
	return mix(c, c * vec3(1.08, 1.04, 0.96), (1.0 - north) * age * 0.3);
}
// how old a thing standing at p is: its own roll, and the neighbourhood's (kilometre-scale
// noise), weighted by kind (base: how old that kind tends to be)
float wxAge(vec2 p, float base, float own){
	float hood = wxN(mod(p, 100000.0) / 900.0 + 3.7);
	return clamp(base + (hood - 0.5) * 0.5 + (own - 0.5) * 0.4, 0.0, 1.0);
}
`;

// ---------- the forest's fallen wood ----------
// logs, limbs, stumps and snags (forestfloor.js): the bark sloughing off to soft red-brown
// punky wood, checked along the grain, moss thick on the top, bracket fungi on the sides,
// pale lichen, the underside dark and wet; a snag weathered silver. The pattern is laid in
// the wood's own metres (its instance scale), round and along its axis.
export function rotWood(m) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.vertexShader = 'varying vec3 vRotL; varying vec3 vRotW; varying vec3 vRotN; varying float vRotS; varying float vRotV;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			{
				#ifdef USE_INSTANCING
				vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
				vRotW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
				vRotN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
				vRotS = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
				vRotV = abs(normalize(instanceMatrix[1].xyz).y);
				#else
				vec3 isc = vec3(1.0);
				vRotW = (modelMatrix * vec4(position, 1.0)).xyz; vRotN = normalize(mat3(modelMatrix) * normal); vRotS = 0.5; vRotV = 1.0;
				#endif
				vRotL = position * isc;
			}`);
		sh.fragmentShader = 'varying vec3 vRotL; varying vec3 vRotW; varying vec3 vRotN; varying float vRotS; varying float vRotV;\n' + WALL_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 n = normalize(vRotN);
				float fog = 1.0 - smoothstep(22000.0, 58000.0, vRotW.x);
				float px = length(fwidth(vRotW));
				float mid = 1.0 - smoothstep(0.03, 0.12, px);
				// the wood's own surface: round its axis (metres of arc) and along it
				float rr = max(length(vRotL.xz), 0.05);
				vec2 bp = vec2(atan(vRotL.z, vRotL.x) * rr, vRotL.y) + vRotS * 40.0;
				float standing = step(0.7, vRotV);
				float decay = clamp(0.35 + vRotS * 0.5 + fog * 0.2 - standing * 0.25, 0.0, 1.0);
				vec3 c = diffuseColor.rgb;
				// bark sloughed away in patches to soft red-brown rotten wood, cubed by the rot
				float slough = smoothstep(0.6 - decay * 0.25, 0.66 - decay * 0.25, wxN(bp * vec2(1.1, 0.35)) * 0.7 + wxN(bp * 4.0) * 0.3);
				vec3 punk = mix(vec3(0.32, 0.14, 0.07), vec3(0.42, 0.22, 0.1), wxN(bp * 6.0));
				punk *= 1.0 - 0.45 * mid * max(step(0.9, fract(bp.x * 9.0)), step(0.92, fract(bp.y * 7.0)));
				c = mix(c, standing > 0.5 ? mix(vec3(0.5, 0.49, 0.46), vec3(0.62, 0.6, 0.56), wxN(bp * 3.0)) : punk, slough * (0.5 + 0.4 * decay));
				// checks split along the grain
				float gx = bp.x * 3.0 + wxN(bp * vec2(0.5, 0.25)) * 2.0, gd = min(fract(gx), 1.0 - fract(gx)), gw = fwidth(gx);
				float chk = (1.0 - smoothstep(0.03, 0.03 + gw * 1.2, gd)) * (1.0 - smoothstep(0.05, 0.2, gw));
				c *= 1.0 - chk * 0.45 * (0.4 + decay);
				// moss: a cushion over the top of a fallen log, thick in the fog; up a stump's
				// north side
				float top = clamp(n.y, 0.0, 1.0), northS = clamp(-n.z, 0.0, 1.0);
				float moss = (1.0 - standing) * smoothstep(0.15, 0.6, top) * (0.4 + 0.6 * fog) + standing * northS * (1.0 - smoothstep(0.3, 2.2 + fog * 2.0, vRotL.y)) * 0.6 * fog;
				moss *= smoothstep(0.3, 0.6, wxN(bp * 1.4 + 3.0) * 0.6 + decay * 0.5);
				vec3 mossC = mix(vec3(0.06, 0.13, 0.02), vec3(0.16, 0.24, 0.04), wxN(bp * 9.0) * mid + (1.0 - mid) * 0.5);
				c = mix(c, mossC, clamp(moss * 1.3, 0.0, 0.92));
				// bracket fungi along the sides: cream shelves, the odd sulphur-orange one
				float side = 1.0 - smoothstep(0.35, 0.7, abs(n.y));
				vec2 fc = floor(bp * vec2(2.2, 3.0)), ff = fract(bp * vec2(2.2, 3.0)) - 0.5;
				float fh = wxH(fc + 17.0);
				float shelf = step(0.9 - decay * 0.08, fh) * (1.0 - smoothstep(0.26, 0.32, length(ff * vec2(1.0, 1.8)))) * side * (1.0 - standing * 0.6) * mid;
				c = mix(c, fh > 0.975 ? vec3(0.75, 0.45, 0.08) : mix(vec3(0.5, 0.4, 0.28), vec3(0.64, 0.56, 0.42), step(0.1, ff.y)), shelf * 0.8);
				// lichen crusts: pale grey-green, on the snags and the drier wood
				c = mix(c, vec3(0.42, 0.45, 0.36), smoothstep(0.74, 0.8, wxN(bp * 5.0 + 11.0)) * (0.3 + 0.7 * standing) * (0.4 + 0.6 * fog) * 0.7);
				// underneath: dark and wet where it lies on the ground
				float under = (1.0 - standing) * smoothstep(-0.1, -0.6, n.y);
				c *= 1.0 - under * 0.4;
				diffuseColor.rgb = c;
				wxDampW = under * 0.6 + moss * 0.2;
			}`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, wxDampW);').replace('void main() {', 'float wxDampW = 0.0;\nvoid main() {');
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|rotwood1';
	return m;
}

// the walls of a house built close by (housekit.js): its stucco weathered as its age
// says; y above the house's floor is the geometry's own
export function weatherStucco(m) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.vertexShader = 'varying vec3 vWxW; varying vec3 vWxN; varying float vWxY; varying vec2 vWxO;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vWxW = (modelMatrix * vec4(position, 1.0)).xyz; vWxN = normalize(mat3(modelMatrix) * normal); vWxY = position.y; vWxO = modelMatrix[3].xz;`);
		sh.fragmentShader = 'varying vec3 vWxW; varying vec3 vWxN; varying float vWxY; varying vec2 vWxO;\n' + WALL_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			if (abs(vWxN.y) < 0.5) {
				float age = wxAge(vWxO, 0.35, wxH(floor(vWxO * 0.5) + 0.17));
				diffuseColor.rgb = wallAge(diffuseColor.rgb, vWxW, normalize(vWxN), vWxY + 0.3, 6.0, 1.0, age, length(fwidth(vWxW)), 0.0);
			}`);
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|wxstucco1';
	return m;
}

// the pitched roofs of the far and middle houses (city.js): streaked and mossed as they age
export function weatherRoofs(m) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.vertexShader = 'varying vec3 vWxW; varying vec3 vWxN; varying vec2 vWxO;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			#ifdef USE_INSTANCING
			vWxW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz; vWxN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vWxO = (modelMatrix * instanceMatrix[3]).xz;
			#else
			vWxW = (modelMatrix * vec4(position, 1.0)).xyz; vWxN = normalize(mat3(modelMatrix) * normal); vWxO = modelMatrix[3].xz;
			#endif`);
		sh.fragmentShader = 'varying vec3 vWxW; varying vec3 vWxN; varying vec2 vWxO;\n' + WALL_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			diffuseColor.rgb = roofAge(diffuseColor.rgb, vWxW, normalize(vWxN), wxAge(vWxO, 0.4, wxH(floor(vWxO * 0.5) + 0.3)));`);
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|wxroof1';
	return m;
}
