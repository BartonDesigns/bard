// The look: a grade on top of AgX. AgX by itself is a neutral base, made to be graded: it
// rolls highlights off and keeps colours from going neon, but left alone it reads flat and
// pale (Josh's iPhone recording at Aquatic Park, 2026-10-21: sand, water and an overcast
// sky all came out the same grey). This is the look Blender lays on AgX for the same
// reason ("Punchy" and its kin), set for Bard:
//  - contrast as an S round a mid-grey pivot, 0 and 1 held, so the shade and the deep water
//    go down, the bright cloud and the lit sand go up, and nothing clips that did not. Up
//    the scale it works channel by channel, as film does, so the brightest colours go toward
//    white; in the darks it holds each colour's own balance, since a toe taken channel by
//    channel pushes a dark green neon (the tree's shade at dusk);
//  - saturation back, most in the mid-tones, tapering to nothing in the near-blacks and
//    less in the near-whites (where film loses it too, and where a strong push would go
//    muddy or neon: a tree's shade at dusk went a saturated near-black green), and held
//    back on skin's orange, which goes fake long before the sky and the grass are rich;
//  - a whisper of split toning: shade a touch cool, light a touch warm.
// It runs inside the tone mapping every material already does, so it is the same few
// operations a pixel in every shader, no pass and no target. It is put in before anything
// is compiled and never changed while the game runs (a change rebuilds every shader, which
// is what crashes phones). sky.js tone maps the fog colour on the CPU with the same curve
// (agx there), so the haze matches what it fades into.

import * as THREE from 'three';

export const GRADE = {
	// contrast round the pivot (AgX's encoded 0..1; the pivot sits a little over middle grey,
	// so the pale sand, the lit walls and the grey cloud of a bright day spread apart instead
	// of all brightening together)
	contrast: 1.35, pivot: 0.57,
	// saturation in the mid-tones (1: AgX as it is), and how much of it skin tones are spared
	sat: 1.22, skin: 0.8,
	// split toning: added to the shade and to the light, in AgX's encoded RGB
	shade: [-0.006, 0.0, 0.012], light: [0.012, 0.004, -0.010],
	// the scene a touch under: a bright day sat high and pale in AgX (sky.js opens it back
	// up by night, so the night keeps the brightness the town's light was tuned to)
	exposure: 0.9,
};

// rec. 2020 luma: AgX works in rec. 2020 primaries
const LUMA = [0.2627, 0.678, 0.0593];
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const glsl = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const vec3 = (a) => `vec3( ${a.map(glsl).join(', ')} )`;

function lookGLSL(G) {
	return /* glsl */`
vec3 bardLook( vec3 v ) {
	const float P = ${glsl(G.pivot)};
	const float C = ${glsl(G.contrast)};
	vec3 lo = P * pow( max( v / P, 0.0 ), vec3( C ) );
	vec3 hi = 1.0 - ( 1.0 - P ) * pow( max( ( 1.0 - v ) / ( 1.0 - P ), 0.0 ), vec3( C ) );
	vec3 vc = mix( lo, hi, step( P, v ) );
	float l0 = dot( v, ${vec3(LUMA)} ), lc = dot( vc, ${vec3(LUMA)} );
	v = mix( v * ( lc / max( l0, 1e-4 ) ), vc, smoothstep( 0.08, 0.45, l0 ) );
	float l = lc;
	float k = mix( 1.0, ${glsl(G.sat)}, min( 1.0, smoothstep( 0.04, 0.42, l ) * 2.0 * ( 1.0 - l ) ) );
	// (skin: red over green over blue, green about half way between)
	float hr = ( v.g - v.b ) / max( v.r - v.b, 1e-4 );
	k += ( 1.0 - k ) * step( v.b, v.g ) * step( v.g, v.r ) * clamp( 1.0 - abs( hr - 0.5 ) * 3.0, 0.0, 1.0 ) * ${glsl(G.skin)};
	v = l + ( v - l ) * k;
	v += ${vec3(G.shade)} * ( 1.0 - l ) * ( 1.0 - l ) + ${vec3(G.light)} * l * l;
	return clamp( v, 0.0, 1.0 );
}
`;
}

// the same on the CPU, for one colour in AgX's encoded space ([r, g, b] in, [r, g, b] out)
export function bardLook(v, G = GRADE) {
	const P = G.pivot, C = G.contrast;
	const vc = v.map((x) => (x < P ? P * Math.pow(Math.max(x / P, 0), C) : 1 - (1 - P) * Math.pow(Math.max((1 - x) / (1 - P), 0), C)));
	const luma = (x) => x[0] * LUMA[0] + x[1] * LUMA[1] + x[2] * LUMA[2];
	const l0 = luma(v), l = luma(vc), w = smoothstep(0.08, 0.45, l0);
	v = v.map((x, i) => x * (l / Math.max(l0, 1e-4)) * (1 - w) + vc[i] * w);
	let k = 1 + (G.sat - 1) * Math.min(1, smoothstep(0.04, 0.42, l) * 2 * (1 - l));
	const hr = (v[1] - v[2]) / Math.max(v[0] - v[2], 1e-4);
	if (v[1] >= v[2] && v[0] >= v[1]) k += (1 - k) * Math.min(1, Math.max(0, 1 - Math.abs(hr - 0.5) * 3)) * G.skin;
	return v.map((x, i) => Math.min(1, Math.max(0, l + (x - l) * k + G.shade[i] * (1 - l) * (1 - l) + G.light[i] * l * l)));
}

let base = null;
// the look into three's AgX, before any material is compiled (main.js). Called again with
// new numbers it only rewrites the chunk: the materials must be rebuilt to show it, which is
// for tuning on a computer, never on a phone in play.
export function installGrade(G = GRADE) {
	base ||= THREE.ShaderChunk.tonemapping_pars_fragment;
	const at = base.indexOf('vec3 AgXToneMapping(');
	// (right after AgX's sigmoid, where Blender lays its looks; three's built chunk has no comments)
	const hook = 'color = agxDefaultContrastApprox( color );';
	if (at < 0 || base.indexOf(hook) < 0) { console.warn('[grade] three\'s AgX has changed; the look is off'); return false; }
	THREE.ShaderChunk.tonemapping_pars_fragment = base.slice(0, at) + lookGLSL(G) + base.slice(at)
		.replace(hook, hook + '\n\tcolor = bardLook( color );')
		.replace('color *= toneMappingExposure;', `color *= toneMappingExposure * ${glsl(G.exposure)};`);
	return true;
}
