// Paint that belongs to its wall. A tag, a piece, a crew's buff or a painted advert is not a
// sticker laid over the brick: it lies in the wall's own light and dirt. So each paint decal
// knows its host (the building, the freeway's concrete, the bin it is on): where the wall's
// foot is, how tall it is, how old, what it is made of and its colour. The paint shader then
// gives it what the wall's own shader gives the wall round it (bay/city.js: the warehouse's
// ribs, the shade low by the ground; bay/weathering.js wallAge: the rain streaks, the
// splash-back, the sun's bleaching, the rust run down from a bracket), and the years of its
// own: the colour chalked and bleached unevenly (more on the sunny faces), flakes let go
// where it has been kicked and splashed and along the metal's folds, dust dulling it; a spray
// can's overspray and its uneven passes, a roller's bands. A crew's buff is the wall's colour a
// shade off, with the ghost of what it covers. Plain numbers here for placement (node tests);
// the GLSL for signage/materials.js.

// what the host is made of (the shader's surface type): 0 not known (an off-world wall, a sign
// back), 1 the freeway's poured concrete, 2 a bin's painted steel, 3..7 a city building's wall
// as its shader draws it (bay/city.js buildingMaterial): 3 a house's or a row's (stucco and
// render), 4 an office's or a tower's (concrete), 5 a warehouse's (ribbed metal), 6 a strip
// mall's, 7 the garages, shops and bays (no shade at the foot there)
export const SURFACE = Object.freeze({ unknown: 0, freeway: 1, bin: 2, wall: 3, office: 4, warehouse: 5, retail: 6, small: 7 });
// how the paint went on: a spray can, a roller and brush (a painted advert), a crew's roller of
// grey (the buff), a scar (damage, not paint at all)
export const STYLE = Object.freeze({ spray: 0, mural: 1, buff: 2, scar: 3 });
// the decal's extra flag for paint (aFx.w): its gloss (the chrome and enamel pieces) and style
export const paintExtra = (style = STYLE.spray, gloss = false) => (gloss ? 1 : 0) + 2 * (style | 0);
// the freeway's concrete and the bins' paint (bay/freeways.js, structures/alleyview.js), linear
export const FREEWAY_WALL = [0.6, 0.56, 0.49], FREEWAY_CONCRETE = [0.66, 0.64, 0.6];
export const BIN_PAINT = [[0.13, 0.3, 0.17], [0.12, 0.22, 0.42]];

const toSrgb = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
const byte = (c) => Math.max(0, Math.min(255, Math.round(c * 255)));
// a colour as one float: 8 bits a channel in sRGB, plus one (0: not known). A float holds
// every whole number to 2^24 exactly, so the three bytes come back as they went.
export function packColour(rgb, linear = false) {
	if (!rgb || rgb.length < 3 || !rgb.every(Number.isFinite)) return 0;
	const [r, g, b] = rgb.map((c) => byte(linear ? toSrgb(Math.max(0, c)) : c));
	return r * 65536 + g * 256 + b + 1;
}
export function unpackColour(v) {
	if (!(v >= 1)) return null;
	const n = Math.round(v) - 1;
	return [Math.floor(n / 65536) / 255, (Math.floor(n / 256) % 256) / 255, (n % 256) / 255];
}
// a city building's kind (bay/city.js KIND, as its shader reads it) to the wall it draws
export function cityWallType(kind) {
	const K = +kind;
	if (!Number.isFinite(K)) return SURFACE.unknown;
	if (K < 1.5) return SURFACE.wall;
	if (K < 3.5) return SURFACE.office;
	if (K < 4.5) return SURFACE.unknown;       // (paved: no wall)
	if (K < 5.5) return SURFACE.warehouse;
	if (K < 6.5) return SURFACE.retail;
	if (K < 7.5) return SURFACE.unknown;       // (plain: fields and plazas)
	if (K < 12.5) return SURFACE.small;
	return SURFACE.unknown;                    // (pools, flats in their courts, courts, parapets)
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// the host as the decal carries it (aHost): its foot (y), its height, type + age x 0.99 (the
// age 0 new .. 1 let go) and its colour; null where nothing is known
export function host(y, height, type, age, colour = 0) {
	if (!Number.isFinite(y) || !(height > 0) || !type) return null;
	return [y, height, type + clamp01(Number.isFinite(age) ? age : 0.4) * 0.99, colour];
}
// a city lot (bay/city.js: x, z, y its foot, h, kind, age, col in sRGB) as a host
export function lotHost(o) {
	if (!o || !Number.isFinite(o.y) || !(o.h > 0)) return null;
	return host(o.y, o.h, cityWallType(o.kind), o.age ?? 0.4, packColour(o.col));
}
// the freeway's walls: their age is the stretch's own (they went up when the freeway did)
export function freewayHost(y, height, x, z, colour = FREEWAY_WALL) {
	const age = 0.3 + 0.45 * frac(Math.sin(Math.round(x / 120) * 12.9898 + Math.round(z / 120) * 78.233) * 43758.5453);
	return host(y, height, SURFACE.freeway, age, packColour(colour, true));
}
export const binHost = (y, v = 0) => host(y, 1.3, SURFACE.bin, 0.55, packColour(BIN_PAINT[v ? 1 : 0], true));
function frac(v) { return v - Math.floor(v); }

// how old a piece of paint is on a wall (the decal's wear): a few fresh, most a season or two,
// the rest years old; where the crews come often (well off), younger
export function paintAge(r, { means = 0.5 } = {}) {
	const q = r(), k = q < 0.16 ? q / 0.16 * 0.12 : q < 0.66 ? 0.18 + (q - 0.16) / 0.5 * 0.37 : 0.58 + (q - 0.66) / 0.34 * 0.37;
	return clamp01(k * (1.15 - 0.3 * clamp01(means)));
}

// ---------- the shader ----------
// The vertex side: the host into varyings (vSgHost: foot, height, type, age; vSgHostC the
// colour in linear, or -1 where it is not known).
export const PAINT_V_PARS = /* glsl */`
#ifdef SG_HOST
attribute vec4 aHost;
varying vec4 vSgHost; varying vec3 vSgHostC;
#endif
`;
export const PAINT_V = /* glsl */`
#ifdef SG_HOST
{
	vSgHost = vec4(aHost.x, aHost.y, floor(aHost.z + 1e-3), fract(aHost.z + 1e-3));
	float pc = floor(aHost.w + 0.5) - 1.0;
	vSgHostC = pc < 0.0 ? vec3(-1.0) : pow(vec3(floor(pc / 65536.0), mod(floor(pc / 256.0), 256.0), mod(pc, 256.0)) / 255.0, vec3(2.2));
}
#endif
`;
// The fragment side. Needs sgN, sgH (signage/materials.js) and WALL_GLSL (wallAge) before it,
// and the varyings above. tex: the art; halo: the art a few mips down, for the overspray; uv
// over the decal; w, n: the world point and normal; style (STYLE), age (0 fresh .. 1 old),
// seed. Gives the paint's albedo and how much of it covers the wall; sgWetK, how much the
// rain darkens and glosses it as it does the concrete under it.
export const PAINT_F = /* glsl */`
varying vec4 vSgHost; varying vec3 vSgHostC;
uniform float uSgWet;
float sgWetK = 0.0;
// value noise at f cycles a metre, faded to its middle where a pixel (px metres) is too coarse
// to hold it (it would alias into speckle and lines along the lattice)
float sgOct(vec2 p, float f, float px) { return mix(0.5, sgN(p * f), 1.0 - smoothstep(0.12, 0.35, px * f)); }
vec4 paintOnWall(vec4 tex, vec4 halo, vec2 uv, vec3 w, vec3 n, float style, float age, float seed) {
	float type = vSgHost.z, hostAge = vSgHost.w;
	bool known = vSgHost.y > 0.0;
	// the wall's own metres: along it (the same u the city's shader uses) and up. Paint with no
	// wall known (a stencil on a van, a colony's wall) keeps to its own face instead, so it does
	// not swim as the van drives
	vec2 t = normalize(vec2(-n.z, n.x) + 1e-5);
	float u = dot(w.xz, t), um = mod(u, 1000.0);
	vec2 p = known ? vec2(um, w.y) : uv * vec2(1.6, 0.8) + seed * 13.0;
	float px = known ? length(fwidth(w)) : max(length(fwidth(p)), 1e-5);
	float yb = known ? w.y - vSgHost.x : 1.4;
	vec3 c = tex.rgb;
	// the stroke's edge a little ragged where the paint thinned, never a cut line
	float a = tex.a * smoothstep(0.0, 0.35, tex.a + (sgOct(p + seed * 9.0, 40.0, px) - 0.5) * 0.45);
	if (style < 0.5) {
		// a spray can's overspray: a thin haze round each stroke, speckled where the can spat
		float edgeK = smoothstep(0.0, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
		float speck = 1.0 - smoothstep(0.12, 0.35, px * 110.0);
		float hz = clamp(halo.a * 1.6 - a, 0.0, 1.0) * edgeK * mix(0.6, step(0.55, sgH(floor(p * 110.0) + seed * 7.0)), speck) * 0.3;
		vec3 hc = halo.rgb / max(halo.a, 0.05);
		float na = a + hz * (1.0 - a);
		c = mix(hc, c, a / max(na, 1e-4));
		a = na;
	}
	// how thick it lies: the can's passes in bands along the stroke, a roller's up and down
	float thick = style < 0.5 ? 0.78 + 0.22 * mix(0.5, sgN(vec2(p.x * 1.6, p.y * 7.5) + seed * 11.0), 1.0 - smoothstep(0.12, 0.35, px * 7.5))
		: 0.9 + 0.1 * mix(0.5, sgN(vec2(p.x / 0.23, p.y * 0.7) + seed * 5.0), 1.0 - smoothstep(0.12, 0.35, px * 4.4));
	// the wall under it: the ribs of a warehouse's siding (the city's own shading of them), the
	// concrete's pores the spray skips, stucco's grain
	float ribEdge = 0.0;
	if (type > 4.5 && type < 5.5) {
		float f = fract(u / 0.6);
		c *= 0.9 + 0.1 * step(0.5, f);
		ribEdge = (1.0 - smoothstep(0.0, 0.035, min(abs(f - 0.5), min(f, 1.0 - f)))) * (1.0 - smoothstep(0.01, 0.03, px));
		thick *= 1.0 - 0.18 * ribEdge;
	} else if (type > 0.5 && type < 1.5) {
		float pore = step(0.88, sgH(floor(p * 70.0) + 3.1)) * (1.0 - smoothstep(0.12, 0.35, px * 70.0));
		a *= 1.0 - 0.75 * pore;
		c *= 0.88 + 0.24 * sgOct(p, 33.0, px);
	} else if (type > 2.5) {
		c *= 0.95 + 0.1 * sgOct(p + 1.7, 26.0, px);
	}
	a *= mix(1.0, thick, style < 0.5 ? 1.0 : 0.5);
	// a crew's buff: the wall's own colour a shade off, greyer and mostly darker, its roller's
	// passes and the ghost of what it covers as a shadow in the art's greys (drawn about 0.6)
	if (style > 1.5 && style < 2.5) {
		float off = 0.78 + 0.26 * sgH(vec2(seed * 13.0, 1.7));
		vec3 base = vSgHostC.x >= 0.0 ? mix(vSgHostC, vec3(dot(vSgHostC, vec3(0.3, 0.55, 0.15))), 0.35) * off : vec3(0.3, 0.29, 0.27) * off;
		c = base * dot(tex.rgb, vec3(0.3, 0.55, 0.15)) / 0.6;
	}
	// (the flakes' pattern, a roller's paint in bigger sheets; worked out here, out of the branch,
	// for its derivative)
	vec2 fp = p * (style > 0.5 ? 0.55 : 1.0);
	float fpx = px * (style > 0.5 ? 0.55 : 1.0);
	float fl = sgOct(fp + seed * 17.0, 8.0, fpx) * 0.55 + sgOct(fp + seed * 5.0, 29.0, fpx) * 0.3 + sgOct(fp, 90.0, fpx) * 0.15;
	float fw = max(fwidth(fl), 1e-4);
	// the years of its own
	if (style < 2.5) {
		float south = known ? clamp(n.z, 0.0, 1.0) : 0.3, low = 1.0 - smoothstep(0.15, 1.3, yb);
		float mott = sgN(p * 0.8 + seed * 3.0) * 0.6 + sgOct(p + seed, 3.3, px) * 0.4;
		// chalked and sun-bleached, unevenly: the colour gone out of it, paler; the reds and
		// purples first, to pinks and greys; the blacks to charcoal
		float fade = clamp(age * (0.6 + 0.4 * south) * (0.45 + 0.9 * mott) * (style > 1.5 ? 0.5 : 1.0), 0.0, 1.0);
		float l = dot(c, vec3(0.3, 0.55, 0.15));
		float red = clamp((c.r - max(c.g, c.b)) * 2.5 + (c.b - c.g) * 1.5, 0.0, 1.0);
		c = mix(c, vec3(l) * 0.72 + 0.09 + c * 0.2, fade * (0.6 + 0.3 * red));
		c = max(c, vec3(0.03 + 0.08 * fade));
		// dust and soot dulling it, darker toward the foot
		c *= mix(1.0, (0.84 + 0.12 * mott) * (1.0 - 0.18 * low), age * 0.75);
		// flakes let go: low down where it is kicked and splashed, along the metal's folds, where
		// the sun has had it
		float th = 1.0 - age * (0.3 + 0.28 * low + 0.18 * ribEdge + 0.08 * south) * (style > 1.5 ? 0.6 : 1.0);
		a *= 1.0 - smoothstep(th - fw, th + fw + 0.006, fl);
	}
	// and the wall's: what its own shader draws on it round the paint, drawn on the paint the same
	// (the city's walls: streaks, splash-back, bleaching, rust, damp, the shade low by the ground);
	// elsewhere a splash of dirt at the foot and the concrete's wet in the rain
	if (known && type > 2.5) {
		#ifndef SG_LITE
		float conc = type < 3.5 ? 0.1 : type < 4.5 ? 0.6 : type < 5.5 ? 0.3 : type < 6.5 ? 0.35 : 0.05;
		c = wallAge(c, w, n, yb, vSgHost.y, 6.0, hostAge, px, conc);
		#endif
		if (type < 6.5) c *= mix(0.58, 1.0, smoothstep(0.9, 3.4, yb));
	} else {
		float foot = 1.0 - smoothstep(0.0, 0.35 + 0.8 * age, yb + (sgOct(vec2(p.x, 3.0), 1.1, px) - 0.5) * 0.3);
		c = mix(c, c * vec3(0.6, 0.55, 0.48), foot * (0.25 + 0.45 * age));
		if (type > 0.5 && type < 1.5) { sgWetK = uSgWet; c *= 1.0 - uSgWet * 0.3; }
	}
	return vec4(c, clamp(a, 0.0, 1.0));
}
`;
