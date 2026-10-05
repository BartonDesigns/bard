// One camera-relative orbital pass, on the same canvas as the ground. No second
// WebGL context or full-screen render targets. The ground remains resident below it.
import * as THREE from 'three';
import { GLOBE_ASSET_VERSION } from '../earth/globe-assets.js';
import { createGalacticGargantua228 } from '../../../runtime/gargantua228.mjs';

export const ORBIT_FRAGMENT = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform mat3 uCamera, uGeography, uStars;
uniform vec3 uHome, uMoon, uSun, uLand, uSea, uAir, uGlow, uCloudColor;
uniform float uRadius, uBlend, uAspect, uTan, uEarth, uMapReady, uSeed, uTime;
uniform float uSnow, uCoast, uMoonRadius, uGiant;
uniform sampler2D uMap;
uniform vec4 uMusic;
float hash(vec3 p) { p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float noise(vec3 p) {
	vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
	return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
		mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { return noise(p)*.57 + noise(p*2.03+7.)*.28 + noise(p*4.07+19.)*.15; }
vec2 hit(vec3 ray, vec3 center, float r) {
	float b=dot(ray,center), d=b*b-dot(center,center)+r*r;
	if(d<0.) return vec2(-1.);
	float s=sqrt(d); return vec2(b-s,b+s);
}
vec3 stars(vec3 ray) {
	vec3 d=uStars*ray;
	// Cubical direction cells avoid poles, rows and a wrapping seam.
	vec3 p=d*950., cell=floor(p), f=fract(p)-.5;
	float seed=hash(cell), dotStar=exp(-dot(f,f)*95.)*step(.996,seed);
	vec3 col=mix(vec3(.65,.78,1.),vec3(1.,.82,.59),hash(cell+17.));
	float milky=pow(max(0.,1.-abs(d.y*.83+d.x*.29+d.z*.47)),18.);
	return vec3(.0005,.0008,.002) + vec3(.014,.012,.022)*milky*fbm(d*19.)*(1.+uMusic.y*.65) + col*dotStar*(2.5+uMusic.z*2.+uMusic.w);
}
vec3 ground(vec3 n) {
	vec3 g=uGeography*n;
	float continents=fbm(g*3.7+uSeed);
	vec3 color=mix(uSea,uLand,smoothstep(uCoast-.03,uCoast+.03,continents));
	if(uEarth<.5) color=mix(color,vec3(.77,.84,.9),uSnow*smoothstep(.15,.6,abs(g.y)+continents*.4));
	if(uEarth>.5 && uMapReady>.5) {
		vec2 uv=vec2(atan(g.z,g.x)/6.2831853+.5,asin(clamp(g.y,-1.,1.))/3.14159265+.5);
		vec4 terrain=texture2D(uMap,uv);
		color=terrain.rgb;
		float detail=fbm(g*550.)*.65+fbm(g*1700.)*.35;
		color*=mix(1.,.77+detail*.5,terrain.a);
		color=mix(color,color*vec3(.76,.85,.66),terrain.a*.18*smoothstep(.3,.7,fbm(g*90.)));
	}
	float cloud=smoothstep(.56,.72,fbm(g*24.+vec3(uTime*.001,0.,0.)));
	color=mix(color,uCloudColor,cloud*.78);
	float day=dot(n,uSun), light=.015+max(0.,day)*1.18;
	return color*light+uGlow*pow(max(0.,1.-abs(continents-.51)*26.),5.)*(.2+uMusic.x*.3);
}
void main() {
	vec2 xy=(vUv*2.-1.)*vec2(uAspect,1.);
	vec3 ray=normalize(uCamera*vec3(xy*uTan,-1.));
	vec3 col=stars(ray);
	float sun=max(0.,dot(ray,uSun));
	col+=vec3(1.,.86,.62)*(.02*pow(sun,100.)+.25*pow(sun,3000.)+4.*smoothstep(.99998,.99999,sun));
	float nearest=1.e20;
	vec2 m=hit(ray,uMoon,uMoonRadius);
	if(m.x>0.) { nearest=m.x; vec3 n=normalize(ray*m.x-uMoon); vec3 surface=mix(vec3(.42,.43,.46),mix(vec3(.62,.42,.25),vec3(.86,.73,.53),.5+.5*sin(n.y*70.+fbm(n*12.)*5.)),uGiant); col=surface*(.055+max(0.,dot(n,uSun)))*(.65+.5*fbm(n*40.)); }
	vec2 h=hit(ray,uHome,uRadius);
	if(h.x>0. && h.x<nearest) { nearest=h.x; col=ground(normalize(ray*h.x-uHome)); }
	vec2 air=hit(ray,uHome,uRadius+85.);
	if(air.y>0.) {
		float a=max(0.,air.x), b=min(air.y,nearest), density=0.;
		if(b>a) {
			float stepSize=(b-a)/8.;
			for(int i=0;i<8;i++) { vec3 p=ray*(a+(float(i)+.5)*stepSize)-uHome; density+=exp(-max(0.,length(p)-uRadius)/8.)*stepSize/80.; }
			float day=smoothstep(-.15,.2,dot(normalize(ray*((a+b)*.5)-uHome),uSun));
			vec3 glow=mix(uAir*.04,uAir,day);
			glow+=vec3(.015,.09,.065)*uMusic.x*(.5+.5*sin(dot(ray,vec3(3,1,2))*35.+uTime));
			col=mix(col,glow,clamp(1.-exp(-density),0.,.92));
		}
	}
	gl_FragColor=vec4(col,uBlend);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

// A compact, local lunar pass. It is rendered only after the orbital collider
// has brought the player to the surface, so the player can walk and steer over
// stable crater relief instead of staring at a clipped sphere.
export const LUNAR_FRAGMENT = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform mat3 uCamera;
uniform vec3 uUp, uEast, uNorth, uSun;
uniform vec2 uOrigin, uCrater;
uniform float uAspect, uTan, uSeed, uTime, uEye;
uniform vec4 uMusic;
float hash(vec2 p){ p=fract(p*vec2(127.1,311.7)); return fract(sin(dot(p,vec2(269.5,183.3)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return noise(p)*.58+noise(p*2.04+7.1)*.28+noise(p*4.1+19.2)*.14; }
float crater(vec2 p, vec2 c, float r){
  float d=length(p-c), bowl=-48.*(1.-smoothstep(r*.12,r,d))*(1.-smoothstep(r*.62,r,d));
  float rim=18.*exp(-pow((d-r*.82)/(r*.13),2.));
  float floor=4.*exp(-pow(d/(r*.34),2.));
  return bowl+rim+floor;
}
float terrain(vec2 p){
  float h=(fbm(p*.010+uSeed)*2.-1.)*5.;
  h+=crater(p,uCrater+vec2(0.,180.),220.);
  h+=crater(p,uCrater+vec2(-390.,-115.),92.);
  h+=crater(p,uCrater+vec2(480.,270.),145.);
  h+=crater(p,uCrater+vec2(820.,-360.),55.);
  return h;
}
vec3 sky(vec3 ray){
  float glow=pow(max(0.,dot(ray,normalize(uSun))),280.);
  float band=pow(max(0.,1.-abs(dot(ray,normalize(vec3(.2,.9,.32))))),12.);
  vec3 c=vec3(.002,.004,.012)+vec3(.008,.012,.032)*band;
  vec3 cell=floor(ray*420.); float star=step(.994,hash(cell.xy+cell.z));
  c+=star*vec3(.55,.68,1.)*(.35+uMusic.z*1.4);
  return c+vec3(1.,.82,.55)*glow*2.5;
}
void main(){
  vec2 xy=(vUv*2.-1.)*vec2(uAspect,1.);
  vec3 ray=normalize(uCamera*vec3(xy*uTan,-1.));
  vec3 c=sky(ray); float den=dot(ray,normalize(uUp));
  if(den>-0.028){ gl_FragColor=vec4(c,1.); return; }
  float t=-uEye/den;
  vec2 p=uOrigin;
  for(int i=0;i<4;i++){
    vec3 hit=ray*t;
    p=uOrigin+vec2(dot(hit,uEast),dot(hit,uNorth));
    t=(terrain(p)-uEye)/den;
  }
  if(t<=0.){ gl_FragColor=vec4(c,1.); return; }
  vec2 e=vec2(2.,0.);
  float h=terrain(p), hx=terrain(p+e)-terrain(p-e), hz=terrain(p+e.yx)-terrain(p-e.yx);
  vec3 n=normalize(vec3(-hx*.12,2.,-hz*.12));
  vec3 sun=normalize(vec3(dot(uSun,uEast),dot(uSun,uUp),dot(uSun,uNorth)));
	// Lunar rock keeps a readable fill even when the authored sun is behind the
	// player. The cool fill separates relief from the black sky; the directional
	// term still gives the crater rims a hard, low-angle edge.
	float light=.38+.68*max(0.,dot(n,sun));
	float dust=smoothstep(1300.,0.,length(p-uOrigin));
	float grain=fbm(p*.045+uSeed), relief=clamp((h+20.)/55.,0.,1.);
	vec3 rock=mix(vec3(.22,.24,.28),vec3(.52,.49,.43),fbm(p*.006+uSeed));
	rock*=.72+grain*.42;
	rock*=light*1.12;
	rock*=.82+.28*relief;
	rock+=vec3(.045,.055,.075)*(.35+.65*dust);
	rock+=vec3(.045,.038,.030)*smoothstep(8.,24.,h);
	rock+=vec3(.018,.024,.035)*uMusic.x*(.35+.65*dust);
  float horizon=smoothstep(0.,.12,-den);
  gl_FragColor=vec4(mix(c,rock,horizon),1.);
}`;

export function createOrbitView({ renderer, earth, seed, radius, profile, shared }) {
	const scene = new THREE.Scene(), camera = new THREE.Camera();
	const lunarScene = new THREE.Scene(), lunarCamera = new THREE.Camera();
	const fallback = new THREE.DataTexture(new Uint8Array([30, 65, 110, 255]), 1, 1);
	fallback.needsUpdate = true;
	const uniforms = {
		uCamera: { value: new THREE.Matrix3() }, uGeography: { value: new THREE.Matrix3() }, uStars: { value: new THREE.Matrix3() },
		uHome: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(.3, .8, -.4).normalize() },
		uRadius: { value: radius / 1000 }, uBlend: { value: 0 }, uAspect: { value: 1 }, uTan: { value: .7 },
		uEarth: { value: earth ? 1 : 0 }, uMapReady: { value: 0 }, uMap: { value: fallback },
		uSeed: { value: (seed % 10000) / 100 }, uTime: { value: 0 },
		uLand: { value: new THREE.Color().fromArray(profile?.ground?.grass || [.34, .48, .2]).convertSRGBToLinear() }, uSea: { value: new THREE.Color('#163458') },
		uCloudColor: { value: new THREE.Color().fromArray(profile?.type === 'MAGMA' ? [.28, .23, .2] : [.9, .92, .96]).convertSRGBToLinear() },
		uAir: { value: new THREE.Color(.12, .35, .7) }, uGlow: { value: new THREE.Color().fromArray(earth ? [0, 0, 0] : profile?.glow || [0, 0, 0]) },
		uSnow: { value: profile?.snow || 0 }, uCoast: { value: profile?.type === 'OCEAN' ? .66 : profile?.type === 'ARID' || profile?.type === 'MAGMA' ? .3 : .51 },
		uMoonRadius: { value: profile?.sky?.giant ? 48000 : 1737 }, uGiant: { value: profile?.sky?.giant ? 1 : 0 },
		uMusic: { value: new THREE.Vector4() },
	};
	if (!earth && profile?.water?.tint) uniforms.uSea.value.fromArray(profile.water.tint).convertSRGBToLinear();
	if (!earth && profile?.air?.tint) uniforms.uAir.value.lerp(new THREE.Color().fromArray(profile.air.tint).multiplyScalar(.45), profile.air.mix);
	const material = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: ORBIT_FRAGMENT, transparent: true, depthTest: false, depthWrite: false });
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
	quad.frustumCulled = false; scene.add(quad);
	const lunarUniforms = {
		uCamera: { value: new THREE.Matrix3() }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uEast: { value: new THREE.Vector3(1, 0, 0) }, uNorth: { value: new THREE.Vector3(0, 0, 1) }, uSun: { value: new THREE.Vector3(.3, .8, -.4).normalize() },
		uOrigin: { value: new THREE.Vector2() }, uCrater: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uTan: { value: .7 }, uSeed: { value: (seed % 10000) / 100 }, uTime: { value: 0 }, uEye: { value: 1.7 }, uMusic: { value: new THREE.Vector4() },
	};
	const lunarMaterial = new THREE.ShaderMaterial({ uniforms: lunarUniforms, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: LUNAR_FRAGMENT, depthTest: false, depthWrite: false });
	const lunarQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lunarMaterial); lunarQuad.frustumCulled = false; lunarScene.add(lunarQuad);
	// Gargantua uses the supplied Schwarzschild renderer as a camera-relative
	// distant landmark. A separate transparent pass keeps it behind the player
	// controls while preserving its disk, lensing and music response.
	const gargScene = new THREE.Scene(), gargCamera = new THREE.PerspectiveCamera(60, 1, .01, 1e12);
	const gargantua = createGalacticGargantua228(THREE, 18000, { mobile: /iPhone|iPad|Android|Mobile/i.test(globalThis.navigator?.userAgent || '') });
	gargantua.userData.gargMat.depthTest = false; gargantua.visible = false; gargScene.add(gargantua);
	const gargFallbackUniforms = { uTime: { value: 0 }, uBass: { value: 0 } };
	const gargFallbackMaterial = new THREE.ShaderMaterial({ uniforms: gargFallbackUniforms, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
		vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
		fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform float uTime,uBass;
			float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
			void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;float edge=smoothstep(1.,.78,r);float ring=exp(-pow((r-.42)/.075,2.))*(.6+.4*sin(atan(p.y,p.x)*9.+uTime*.8));float inner=exp(-pow((r-.6)/.2,2.));vec3 c=mix(vec3(.02,.01,.008),vec3(1.,.22,.035),ring);c+=vec3(.08,.28,.75)*exp(-pow((r-.47)/.035,2.));float a=max(.94*step(r,.23),ring*.98+inner*.16);c*=1.+uBass*.28;c+=vec3(.11,.03,.01)*hash(p*180.)*ring;gl_FragColor=vec4(c,a*edge);}` });
	const gargFallback = new THREE.Mesh(new THREE.PlaneGeometry(900000, 900000), gargFallbackMaterial); gargFallback.frustumCulled = false; gargFallback.visible = false; gargScene.add(gargFallback);
	let disposed = false, map = null;
	if (earth) {
		new THREE.TextureLoader().load(new URL(`../assets/orbit-earth.png?v=${GLOBE_ASSET_VERSION}`, import.meta.url).href, (t) => {
			if (disposed) { t.dispose(); return; }
			map = t; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
			uniforms.uMap.value = t; uniforms.uMapReady.value = 1;
		}, undefined, () => { /* the procedural globe remains navigable offline */ });
	}
	// Compile during the initial world load, not on the first climb into orbit.
	renderer.compile(scene, camera); renderer.compile(lunarScene, lunarCamera); renderer.compile(gargScene, gargCamera);
	const inv = new THREE.Matrix3(), rot4 = new THREE.Matrix4();
	const moon = new THREE.Vector3(-2.6e8, 1.8e8, -2.2e8), sun = new THREE.Vector3();
	const geography = new THREE.Matrix3();
	const gargDirection = new THREE.Vector3(-.54, .22, -.81).normalize(), gargAuthored = new THREE.Vector3(), gargForward = new THREE.Vector3(), gargOffset = new THREE.Vector3();
	function anchor(lat = 0, lon = 0, sunDir) {
		const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
		geography.set(-Math.sin(b), Math.cos(a)*Math.cos(b), Math.sin(a)*Math.cos(b), 0, Math.sin(a), -Math.cos(a), Math.cos(b), Math.cos(a)*Math.sin(b), Math.sin(a)*Math.sin(b));
		sun.copy(sunDir).normalize();
	}
	function render(frame, player, sourceCamera, time, options = {}) {
		const k = frame.blend(player.pos);
		if (k <= 0) return;
		const lunar = !!options.moonLanded;
		rot4.makeRotationFromQuaternion(sourceCamera.quaternion); inv.setFromMatrix4(rot4).transpose();
		if (lunar) {
			const basis = frame.moonBasis(player.pos), map = frame.mapPoint(player.pos);
			lunarUniforms.uCamera.value.setFromMatrix4(rot4);
			lunarUniforms.uUp.value.copy(basis.normal); lunarUniforms.uEast.value.copy(basis.east); lunarUniforms.uNorth.value.copy(basis.north);
			lunarUniforms.uSun.value.copy(sun).applyQuaternion(frame.rotation); lunarUniforms.uOrigin.value.set(map.x, map.y);
			const crater = options.moonOrigin || map; lunarUniforms.uCrater.value.set(crater.x, crater.y);
			lunarUniforms.uAspect.value = sourceCamera.aspect; lunarUniforms.uTan.value = Math.tan(sourceCamera.fov*Math.PI/360); lunarUniforms.uTime.value = time;
			lunarUniforms.uMusic.value.set(shared.uBass.value, shared.uMid.value, shared.uHigh.value, shared.uPulse.value);
			const clear = renderer.autoClear; try { renderer.autoClear = true; renderer.render(lunarScene, lunarCamera); } finally { renderer.autoClear = clear; }
			gargantua.visible = false; gargFallback.visible = false;
			return;
		}
		uniforms.uBlend.value = k;
		uniforms.uHome.value.copy(frame.center).sub(player.pos).multiplyScalar(.001);
		uniforms.uMoon.value.copy(moon).applyQuaternion(frame.rotation).add(frame.center).sub(player.pos).multiplyScalar(.001);
		uniforms.uSun.value.copy(sun).applyQuaternion(frame.rotation);
		rot4.makeRotationFromQuaternion(frame.rotation); inv.setFromMatrix4(rot4).transpose();
		uniforms.uGeography.value.copy(geography).multiply(inv);
		uniforms.uStars.value.copy(inv);
		rot4.makeRotationFromQuaternion(sourceCamera.quaternion); uniforms.uCamera.value.setFromMatrix4(rot4);
		uniforms.uAspect.value = sourceCamera.aspect; uniforms.uTan.value = Math.tan(sourceCamera.fov*Math.PI/360); uniforms.uTime.value = time;
		uniforms.uMusic.value.set(shared.uBass.value, shared.uMid.value, shared.uHigh.value, shared.uPulse.value);
		const clear = renderer.autoClear;
		try { renderer.autoClear = k >= 1; renderer.render(scene, camera); } finally { renderer.autoClear = clear; }
		if (k >= .98) {
			// Keep the authored galactic-center bearing when it is in view. If the
			// player is looking elsewhere, ease the beacon toward the current forward
			// ray so Gargantua is always discoverable during the first space flight.
			const authored = gargAuthored.copy(gargDirection).applyQuaternion(frame.rotation).normalize(); sourceCamera.getWorldDirection(gargForward);
			if (authored.dot(gargForward) < .92) authored.lerp(gargForward, .94).normalize();
			// Frame positions are metres; the orbital pass is kilometres. Keep the
			// beacon well outside the 720,000 km disk envelope so the horizon and
			// accretion ring read as a distant object rather than clipping the camera.
			gargOffset.copy(authored).multiplyScalar(6000000000).add(frame.center).sub(player.pos).multiplyScalar(.001);
			gargantua.position.copy(gargOffset); gargantua.visible = true;
			gargFallback.position.copy(gargOffset); gargFallback.lookAt(gargCamera.position); gargFallback.visible = true; gargFallbackUniforms.uTime.value = time; gargFallbackUniforms.uBass.value = shared.uBass.value;
			gargCamera.position.set(0, 0, 0); gargCamera.quaternion.copy(sourceCamera.quaternion); gargCamera.fov = sourceCamera.fov; gargCamera.aspect = sourceCamera.aspect; gargCamera.updateProjectionMatrix(); gargCamera.updateMatrixWorld(true);
			const passClear = renderer.autoClear; try { renderer.autoClear = false; renderer.render(gargScene, gargCamera); } finally { renderer.autoClear = passClear; }
		} else { gargantua.visible = false; gargFallback.visible = false; }
	}
	return { anchor, render, uniforms, lunarUniforms, gargantua, dispose() { disposed = true; quad.geometry.dispose(); material.dispose(); lunarQuad.geometry.dispose(); lunarMaterial.dispose(); map?.dispose(); fallback.dispose(); gargantua.userData.gargMat.dispose(); gargantua.userData.gargBillboard.geometry.dispose(); gargFallback.geometry.dispose(); gargFallbackMaterial.dispose(); } };
}
