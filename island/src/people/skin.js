// Skin that is not plastic: the painted maps (body.js) lit as skin is. Light wraps round
// the terminator warm and red, as it does through living flesh, most where the flesh is thin
// (ears, the nose's wings, fingers), and shows through them lit from behind; the baked
// shade of the folds (eye sockets, nostrils, under the chin, armpits, between the fingers,
// the ears' curls) darkens what the sky and the bounce light reach; the T-zone has a soft sheen and
// the cheeks stay matte; cheeks, nose and ears flush a little; and close up, pores and fine
// lines break the highlight (not on phones). No textures beyond the skin's own map: the
// baked shading rides a vertex attribute (skinx: ao, thin, oil, flush; face.js).

import * as THREE from 'three';
import { INK_GLSL, inkUniforms } from '../tattoo/skinink.js';

const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const HEAD = /* glsl */`
uniform vec4 uScalp;
uniform vec4 uBeard;
uniform vec4 uSkin;
uniform vec4 uVit;
varying float vScalp;
varying float vBeard;
varying vec2 vScalpUv;
varying vec4 vSkin;
varying vec3 vBindP;
float sh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sn3(vec3 x) {
	vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

// light through the skin: after the usual diffuse and specular, the wrap's warm terminator
// and light from behind through thin flesh. Highlights and the warm glow need strong direct
// light: the sun's leak into shade (sky.js keeps a fifth of it) and the moon leave the skin matte
const SSS = /* glsl */`
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 s0 = reflectedLight.directSpecular;
#ifdef USE_SHEEN
	vec3 h0 = sheenSpecularDirect;
#endif
	RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	float k = smoothstep( 0.9, 2.6, dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) ) );
	// (capped, so no spot outshines the skin's own colour)
	reflectedLight.directSpecular = s0 + min( ( reflectedLight.directSpecular - s0 ) * k, directLight.color * 0.08 );
#ifdef USE_SHEEN
	sheenSpecularDirect = h0 + ( sheenSpecularDirect - h0 ) * k;
#endif
	float nl = dot( geometryNormal, directLight.direction );
	vec3 w = vec3( 0.3, 0.13, 0.09 ) * ( 1.0 + vSkin.y * 0.5 ) * uSkin.x;
	vec3 wr = clamp( ( vec3( nl ) + w ) / ( 1.0 + w ), 0.0, 1.0 );
	float g = 0.3 + 0.7 * k;
	reflectedLight.directDiffuse += g * max( wr * wr * ( 3.0 - 2.0 * wr ) * 0.85 - vec3( saturate( nl ) ), 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor );
	float back = pow( saturate( dot( geometryViewDir, -directLight.direction ) ), 3.0 ) * saturate( 0.3 - nl );
	reflectedLight.directDiffuse += k * vSkin.y * back * directLight.color * material.diffuseColor * vec3( 1.0, 0.4, 0.25 ) * uSkin.x * 0.8;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin
`;

export function skinMaterial(map, tint, age) {
	// (the sheen is the skin's own colour, so it softens the edges without paling dark skin)
	const m = new THREE.MeshPhysicalMaterial({ map, color: tint, roughness: 0.6, metalness: 0, ior: 1.4, specularIntensity: 0.5, sheen: 0.05, sheenRoughness: 0.85, sheenColor: tint.clone().multiplyScalar(0.4) });
	// a close crop of hair painted on the scalp (a buzz cut, or what shows under a cap)
	const scalpU = { value: new THREE.Vector4(0, 0, 0, 0) };
	// the shadow of a beard shaved or under a beard: its colour and how heavy
	const beardU = { value: new THREE.Vector4(0, 0, 0, 0) };
	// x: how much light goes through (0 for the far worlds' painted skins), y: pore depth by
	// age, z: how shiny the T-zone, w: the flush
	const skinU = { value: new THREE.Vector4(1, 0.6 + Math.min(1, Math.max(0, (age - 25) / 50)) * 0.8, 1, 1) };
	// vitiligo (a person in a hundred): x on, yzw where their patches fall
	const vitU = { value: new THREE.Vector4(0, 0, 0, 0) };
	m.userData.scalp = scalpU;
	m.userData.beard = beardU;
	m.userData.skin = skinU;
	m.userData.vit = vitU;
	// tattoos: none until someone's are laid on (tattoo/skinink.js)
	const inkU = inkUniforms();
	m.userData.ink = inkU;
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uScalp = scalpU;
		sh.uniforms.uBeard = beardU;
		sh.uniforms.uSkin = skinU;
		sh.uniforms.uVit = vitU;
		Object.assign(sh.uniforms, inkU);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float scalp;\nattribute float beard;\nattribute vec4 skinx;\nvarying float vScalp;\nvarying float vBeard;\nvarying vec2 vScalpUv;\nvarying vec4 vSkin;\nvarying vec3 vBindP;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvScalp = scalp;\nvBeard = beard;\nvScalpUv = uv;\nvSkin = skinx;\nvBindP = position;');
		sh.fragmentShader = (isPhone ? '' : '#define SKIN_PORES\n') + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD + INK_GLSL)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + SSS)
			.replace('#include <color_fragment>', `#include <color_fragment>
// tattoos: ink in the skin, a multiply of its own colour (tattoo/skinink.js)
diffuseColor.rgb *= inkAt(vBindP);
// stubble: the cut hairs just under and through the skin, a fine grain, soft-edged
// (far off, just its shade: no grain to shimmer)
if (uBeard.w > 0.0) {
	vec2 bq = vScalpUv * 1400.0;
	float bg = mix(fract(sin(dot(floor(bq), vec2(12.9898, 78.233))) * 43758.5453), 0.5, smoothstep(0.3, 1.0, length(fwidth(bq))));
	diffuseColor.rgb = mix(diffuseColor.rgb, uBeard.rgb, vBeard * uBeard.w * (0.45 + 0.55 * bg) * 0.6);
}
diffuseColor.rgb = mix(diffuseColor.rgb, uScalp.rgb * (0.8 + 0.4 * fract(sin(dot(floor(vScalpUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453)), smoothstep(0.2, 0.8, vScalp) * uScalp.w);
// the flush: blood near the surface of the cheeks, the nose, the ears, the lips; faint, a
// multiply of the skin's own colour, so it never reads as a patch
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.02, 0.94, 0.93), vSkin.w * uSkin.w * (1.0 - uScalp.w * smoothstep(0.2, 0.8, vScalp)));
// vitiligo: soft-edged pale patches where the pigment has gone, for the few who have it
if (uVit.x > 0.5) {
	float v = sn3(vBindP * 9.0 + uVit.yzw) * 0.7 + sn3(vBindP * 23.0 + uVit.zwy) * 0.3;
	float t = mix(0.6, 0.54, smoothstep(1.4, 1.52, vBindP.y));        // (most often on the face)
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.54, 0.46), smoothstep(t, t + 0.04, v) * (1.0 - smoothstep(0.2, 0.8, vScalp)));
}`)
			.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
// a slightly oilier T-zone and lips, matte cheeks: a broad soft sheen, never a patch (on dark
// skin a bright patch reads as lost pigment); a faint grain, gone before it could shimmer
float rq = length( fwidth( vBindP * 120.0 ) );
roughnessFactor = mix( 0.62, 0.54, smoothstep( 0.2, 0.9, vSkin.z ) * uSkin.z ) + ( sn3( vBindP * 120.0 ) - 0.5 ) * 0.03 * ( 1.0 - smoothstep( 0.2, 0.6, rq ) );`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef SKIN_PORES
{
	// pores and fine lines as a bump, only close enough to see
	float fade = 1.0 - smoothstep(0.6, 2.2, length(vViewPosition));
	if (fade > 0.0) {
		vec3 q = vBindP * 1400.0;
		fade *= 1.0 - smoothstep(0.35, 0.9, length(fwidth(q)));
		float h = sn3(q) * 0.6 + sn3(q * 2.3 + 7.0) * 0.4;
		h = smoothstep(0.25, 0.75, h) - 0.5;
		h += (sn3(vec3(vBindP.x * 90.0, vBindP.y * 900.0, vBindP.z * 90.0)) - 0.5) * 0.6 * (uSkin.y - 0.6);
		h *= 0.00004 * uSkin.y * fade;
		vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
		vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
		float det = dot(sx, r1);
		vec2 dh = vec2(dFdx(h), dFdy(h));
		normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
	}
}
#endif`)
			.replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
	// the folds' baked shade: the sky and bounce light most, the sun a little
	float ao = vSkin.x;
	reflectedLight.indirectDiffuse *= mix(1.0, ao, 0.75);
	reflectedLight.indirectSpecular *= ao * ao;
	reflectedLight.directDiffuse *= mix(1.0, ao, 0.2);
	reflectedLight.directSpecular *= mix(1.0, ao, 0.6);
}`);
	};
	m.customProgramCacheKey = () => 'crysis-skin-6' + (isPhone ? '-lo' : '');
	return m;
}
