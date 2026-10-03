// One camera-relative orbital pass, on the same canvas as the ground. No second
// WebGL context or full-screen render targets. The ground remains resident below it.
import * as THREE from 'three';

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

export function createOrbitView({ renderer, earth, seed, radius, profile, shared }) {
	const scene = new THREE.Scene(), camera = new THREE.Camera();
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
	let disposed = false, map = null;
	if (earth) {
		new THREE.TextureLoader().load(new URL('../assets/orbit-earth.png', import.meta.url).href, (t) => {
			if (disposed) { t.dispose(); return; }
			map = t; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
			uniforms.uMap.value = t; uniforms.uMapReady.value = 1;
		}, undefined, () => { /* the procedural globe remains navigable offline */ });
	}
	// Compile during the initial world load, not on the first climb into orbit.
	renderer.compile(scene, camera);
	const inv = new THREE.Matrix3(), rot4 = new THREE.Matrix4();
	const moon = new THREE.Vector3(-2.6e8, 1.8e8, -2.2e8), sun = new THREE.Vector3();
	const geography = new THREE.Matrix3();
	function anchor(lat = 0, lon = 0, sunDir) {
		const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
		geography.set(-Math.sin(b), Math.cos(a)*Math.cos(b), Math.sin(a)*Math.cos(b), 0, Math.sin(a), -Math.cos(a), Math.cos(b), Math.cos(a)*Math.sin(b), Math.sin(a)*Math.sin(b));
		sun.copy(sunDir).normalize();
	}
	function render(frame, player, sourceCamera, time) {
		const k = frame.blend(player.pos);
		if (k <= 0) return;
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
	}
	return { anchor, render, uniforms, dispose() { disposed = true; quad.geometry.dispose(); material.dispose(); map?.dispose(); fallback.dispose(); } };
}
