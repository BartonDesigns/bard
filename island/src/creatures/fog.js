// The Fog Mother's look: her body (the model built from her sheet, creatures/models.js) made fog.
// The paint stays (the old woman's face, the folds of the robe, the blue heart), but she is
// thin where the surface turns from you and solid only where it faces you, the thinness drifts
// and rolls as fog does, and her robe frays to nothing toward the water. Round her, puffs of fog
// keep coming off her shoulders, arms and robe and blowing away behind her. The heart in her chest
// burns blue and lights the fog round it.
//
// fogLook(c, { phone }) -> { update(dt, { glow, fade }), heart(out) } (combat/bosses.js fogMother())

import * as THREE from 'three';

let puffTex = null;
function puffTexture() {
	if (puffTex) return puffTex;
	const cv = document.createElement('canvas');
	cv.width = cv.height = 128;
	const g = cv.getContext('2d');
	// (a soft round puff, a little lumpy)
	for (let i = 0; i < 9; i++) {
		const x = 64 + Math.cos(i * 2.4) * (i ? 22 : 0), y = 64 + Math.sin(i * 2.4) * (i ? 18 : 0), r = i ? 34 : 52;
		const gr = g.createRadialGradient(x, y, 0, x, y, r);
		gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
	}
	puffTex = new THREE.CanvasTexture(cv);
	puffTex.colorSpace = THREE.SRGBColorSpace;
	return puffTex;
}

export function fogLook(c, { phone = false } = {}) {
	const H = c.meta.height || 3;
	const time = { value: 0 }, glow = { value: 1 }, fade = { value: 1 };
	c.root.traverse((o) => {
		if (!o.isMesh) return;
		const m = o.material.clone();
		// (dithered, not blended: no sorting of her against herself, and her shadow thins with her)
		m.alphaHash = true;
		m.color.multiplyScalar(1.15);
		m.onBeforeCompile = (sh) => {
			sh.uniforms.uTime = time; sh.uniforms.uGlow = glow; sh.uniforms.uFade = fade; sh.uniforms.uH = { value: H };
			sh.vertexShader = 'varying vec3 vFP;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n\tvFP = transformed;');
			sh.fragmentShader = 'uniform float uTime;\nuniform float uGlow;\nuniform float uFade;\nuniform float uH;\nvarying vec3 vFP;\n' + sh.fragmentShader
				.replace('#include <alphahash_fragment>', `{
		vec3 nrm = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
		float facing = abs(dot(nrm, normalize(vViewPosition)));
		float roll = 0.5 + 0.5 * sin(vFP.y * 7.0 / uH * 3.0 - uTime * 0.6 + sin(vFP.x * 9.0 / uH * 3.0 + uTime * 0.4) * 1.6);
		float roll2 = 0.5 + 0.5 * sin(vFP.z * 11.0 / uH * 3.0 + uTime * 0.9 + vFP.y * 4.0 / uH * 3.0);
		float frayed = smoothstep(0.0, 0.28 * uH, vFP.y);
		diffuseColor.a *= clamp(0.18 + 0.95 * pow(facing, 1.4), 0.0, 1.0) * (0.55 + 0.3 * roll + 0.25 * roll2) * frayed * uFade;
	}
	#include <alphahash_fragment>`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= uGlow;');
		};
		m.customProgramCacheKey = () => 'fog-mother';
		o.material = m;
		o.castShadow = false;
	});
	// the puffs coming off her
	const bones = [];
	c.root.traverse((o) => { if (o.isBone && /^(chest|spine|upperarm|forearm|hand|shin|thigh|head|hips)/.test(o.name)) bones.push(o); });
	const n = phone ? 16 : 36;
	const mat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xc9d2dc, transparent: true, depthWrite: false, opacity: 0.6, fog: true });
	const puffs = [];
	const group = new THREE.Group();
	for (let i = 0; i < n; i++) {
		const s = new THREE.Sprite(mat.clone());
		s.visible = false;
		group.add(s);
		puffs.push({ s, life: -1, t: 0, v: new THREE.Vector3(), size: 1, wait: Math.random() * 6 });
	}
	// (the puffs in the world, not on her: they blow off behind as she moves)
	let added = false;
	const _p = new THREE.Vector3(), _s = new THREE.Vector3();
	// the heart: a blue light in her chest
	const J = c.meta.joints || {};
	const chest = bones.find((b) => b.name === 'chest');
	const heartModel = new THREE.Vector3(0, J.chest ? (J.chest[0][1] * 0.35 + J.chest[1][1] * 0.65) : H * 0.7, J.chest ? Math.max(J.chest[0][2], J.chest[1][2]) + 0.08 * H / 3 : 0.1);
	c.root.updateMatrixWorld(true);
	const heartLocal = chest ? chest.worldToLocal(heartModel.clone().applyMatrix4(c.root.matrixWorld)) : null;
	const heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0x58b8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
	if (chest) { heartGlow.position.copy(heartLocal); heartGlow.scale.setScalar(0.5 * H / 3); chest.add(heartGlow); }
	const light = phone ? null : new THREE.PointLight(0x4aa8ff, 0, 1, 2);
	if (light && chest) { light.position.copy(heartLocal); chest.add(light); }
	function heart(out) {
		if (!chest) return c.root.getWorldPosition(out);
		return chest.localToWorld(out.copy(heartLocal));
	}
	function update(dt, { glow: gk = 1, fade: fk = 1, wind = null } = {}) {
		time.value += dt; glow.value = gk; fade.value = fk;
		if (!added && c.root.parent) { c.root.parent.add(group); added = true; }
		const k = c.root.scale.x;
		const beat = 0.5 + 0.5 * Math.sin(time.value * 3.2);
		heartGlow.material.opacity = (0.55 + 0.4 * beat) * Math.min(1, gk) * fk;
		heartGlow.scale.setScalar((0.45 + 0.12 * beat) * H / 3 * Math.max(1, gk));
		if (light) { light.intensity = (4 + 3 * beat) * gk * fk * k * k * 0.15; light.distance = 0.9 * H * k; }
		for (const P of puffs) {
			if (P.life < 0) {
				P.wait -= dt;
				if (P.wait > 0 || !bones.length || fk < 0.3) continue;
				const b = bones[Math.floor(Math.random() * bones.length)];
				b.getWorldPosition(_p);
				P.s.position.copy(_p).add(_s.set((Math.random() - 0.5) * 0.25 * H * k, (Math.random() - 0.3) * 0.1 * H * k, (Math.random() - 0.5) * 0.25 * H * k));
				P.v.set((Math.random() - 0.5) * 0.04, 0.02 + Math.random() * 0.03, (Math.random() - 0.5) * 0.04).multiplyScalar(H * k);
				if (wind) P.v.addScaledVector(wind, H * k * 0.04);
				P.life = 6 + Math.random() * 5; P.t = 0; P.size = (0.12 + Math.random() * 0.14) * H * k;
				P.s.visible = true;
			}
			P.t += dt;
			const u = P.t / P.life;
			if (u >= 1) { P.life = -1; P.wait = Math.random() * 2; P.s.visible = false; continue; }
			P.s.position.addScaledVector(P.v, dt);
			P.s.scale.setScalar(P.size * (0.6 + u * 0.9));
			P.s.material.opacity = Math.sin(Math.PI * u) * 0.55 * fk;
			P.s.material.rotation += dt * 0.05;
		}
	}
	return { update, heart, group };
}
