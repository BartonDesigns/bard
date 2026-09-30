// Skin that is not plastic: the painted maps (body.js) lit as skin is. Light wraps round
// the terminator warm and red, as it does through living flesh, most where the flesh is thin
// (ears, the nose's wings, fingers), and shows through them lit from behind; the baked
// shade of the folds (eye sockets, nostrils, under the chin, armpits, between the fingers,
// the ears' curls) darkens what the sky and the bounce light reach; the T-zone shines and
// the cheeks stay matte; cheeks, nose and ears flush a little; and close up, pores and fine
// lines break the highlight (not on phones). No textures beyond the skin's own map: the
// baked shading rides a vertex attribute (skinx: ao, thin, oil, flush; face.js).

import * as THREE from 'three';

const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const HEAD = /* glsl */`
uniform vec4 uScalp;
uniform vec4 uSkin;
varying float vScalp;
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
// and light from behind through thin flesh
const SSS = /* glsl */`
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	float nl = dot( geometryNormal, directLight.direction );
	vec3 w = vec3( 0.5, 0.2, 0.13 ) * ( 1.0 + vSkin.y * 1.2 ) * uSkin.x;
	vec3 wr = clamp( ( vec3( nl ) + w ) / ( 1.0 + w ), 0.0, 1.0 );
	reflectedLight.directDiffuse += max( wr * wr * ( 3.0 - 2.0 * wr ) * 0.85 - vec3( saturate( nl ) ), 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseColor );
	float back = pow( saturate( dot( geometryViewDir, -directLight.direction ) ), 3.0 ) * saturate( 0.3 - nl );
	reflectedLight.directDiffuse += vSkin.y * back * directLight.color * material.diffuseColor * vec3( 1.0, 0.28, 0.14 ) * uSkin.x * 1.5;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin
`;

export function skinMaterial(map, tint, age) {
	const m = new THREE.MeshPhysicalMaterial({ map, color: tint, roughness: 0.55, metalness: 0, ior: 1.4, sheen: 0.2, sheenRoughness: 0.65, sheenColor: new THREE.Color(0.85, 0.55, 0.45) });
	// a close crop of hair painted on the scalp (a buzz cut, or what shows under a cap)
	const scalpU = { value: new THREE.Vector4(0, 0, 0, 0) };
	// x: how much light goes through (0 for the far worlds' painted skins), y: pore depth by
	// age, z: how shiny the T-zone, w: the flush
	const skinU = { value: new THREE.Vector4(1, 0.6 + Math.min(1, Math.max(0, (age - 25) / 50)) * 0.8, 1, 1) };
	m.userData.scalp = scalpU;
	m.userData.skin = skinU;
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uScalp = scalpU;
		sh.uniforms.uSkin = skinU;
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float scalp;\nattribute vec4 skinx;\nvarying float vScalp;\nvarying vec2 vScalpUv;\nvarying vec4 vSkin;\nvarying vec3 vBindP;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvScalp = scalp;\nvScalpUv = uv;\nvSkin = skinx;\nvBindP = position;');
		sh.fragmentShader = (isPhone ? '' : '#define SKIN_PORES\n') + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + SSS)
			.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uScalp.rgb * (0.8 + 0.4 * fract(sin(dot(floor(vScalpUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453)), smoothstep(0.2, 0.8, vScalp) * uScalp.w);
// the flush: blood near the surface of the cheeks, the nose, the ears, the lips
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.86, 0.84), vSkin.w * uSkin.w * (1.0 - uScalp.w * smoothstep(0.2, 0.8, vScalp)));`)
			.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
// an oily T-zone and lips, matte cheeks; finer variation close up
roughnessFactor = mix(0.6, 0.36, vSkin.z * uSkin.z) + (sn3(vBindP * 400.0) - 0.5) * 0.08;`)
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
	reflectedLight.indirectDiffuse *= ao;
	reflectedLight.indirectSpecular *= ao * ao;
	reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);
	reflectedLight.directSpecular *= mix(1.0, ao, 0.6);
}`);
	};
	m.customProgramCacheKey = () => 'crysis-skin-2' + (isPhone ? '-lo' : '');
	return m;
}
