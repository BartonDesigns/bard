// The Lumen Leviathan's body, made here from its sheet (tools/monsters/sheets/lumen-leviathan.jpg):
// a serpent of pale living crystal. Its head is a dragon's skull cut in facets, a third eye burning
// in its brow, a crown of long crystal spikes swept back, a jaw of crystal teeth that opens as it
// strikes. Its body is a tube bent through the points it crawls along each frame, armoured in rows
// of clear chrome scales leaning back toward the tail and a ridge of spines, its belly lit by blue
// veins that show through them.
// At the base of its neck a breastplate of crystal; when the fight turns (combat/boss-defs.js,
// 'Cracked Crest') the crest and the plate go dark and cracked and its eye red, and at the last
// ('Heartlight') the plate bursts and the heart under it blazes.
//
// leviathanBody({ n, radii, phone }) -> { group, update(points, t, { jaw, phase, glow }), eye,
// heart, plate, radius(u) } where points are the n spine points, head first (combat/bosses.js leviathan()).

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { crystalGeometry } from './crystal-legs.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// points mirrored across x (a face's two sides)
const both = (pts) => pts.flatMap(([x, y, z]) => (x ? [V(x, y, z), V(-x, y, z)] : [V(x, y, z)]));

function materials() {
	return {
		skull: new THREE.MeshStandardMaterial({ color: 0xbdb3e6, roughness: 0.2, metalness: 0.1, emissive: 0x2e2070, emissiveIntensity: 0.35, flatShading: true }),
		spike: new THREE.MeshStandardMaterial({ color: 0xb9a9ef, roughness: 0.14, metalness: 0.1, emissive: 0x4a2aa0, emissiveIntensity: 0.55, flatShading: true }),
		scale: chromeMaterial(),
		tooth: new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: 0.2, metalness: 0.05, emissive: 0x6050a0, emissiveIntensity: 0.3, flatShading: true }),
		mouth: new THREE.MeshStandardMaterial({ color: 0x2a1850, roughness: 0.6, emissive: 0x6a3ad0, emissiveIntensity: 0.6 }),
		plate: new THREE.MeshStandardMaterial({ color: 0xcfc6f4, roughness: 0.18, metalness: 0.15, emissive: 0x4a3aa8, emissiveIntensity: 0.45, flatShading: true }),
	};
}

// what the chrome reflects: the Deep's dark, a violet glow overhead and bands of coloured light,
// so every facet catches a different colour as it turns (the world has no environment map)
let envTex = null;
function chromeEnvironment() {
	if (envTex) return envTex;
	const cv = document.createElement('canvas');
	cv.width = 512; cv.height = 256;
	const g = cv.getContext('2d');
	const sky = g.createLinearGradient(0, 0, 0, 256);
	sky.addColorStop(0, '#5a4aa0'); sky.addColorStop(0.3, '#241a50'); sky.addColorStop(0.47, '#8a7ae0'); sky.addColorStop(0.5, '#2a2050'); sky.addColorStop(0.55, '#08060f'); sky.addColorStop(1, '#141020');
	g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
	// (streaks of spectrum, as light through crystal)
	const hues = [195, 280, 320, 40, 160, 230, 300, 60, 180, 340];
	hues.forEach((h, i) => {
		const x = (i / hues.length) * 512 + 20, y = 40 + (i % 3) * 38, w = 70 + (i % 2) * 60;
		const s = g.createLinearGradient(x, 0, x + w, 0);
		s.addColorStop(0, `hsla(${h},95%,65%,0)`); s.addColorStop(0.5, `hsla(${h},95%,70%,0.9)`); s.addColorStop(1, `hsla(${(h + 60) % 360},95%,65%,0)`);
		g.fillStyle = s; g.fillRect(x, y, w, 14 + (i % 3) * 8);
	});
	// (a few hard white glints)
	g.fillStyle = 'rgba(255,255,255,0.95)';
	for (let i = 0; i < 6; i++) g.fillRect(40 + i * 83, 22 + (i * 37) % 60, 26, 4);
	envTex = new THREE.CanvasTexture(cv);
	envTex.mapping = THREE.EquirectangularReflectionMapping;
	envTex.colorSpace = THREE.SRGBColorSpace;
	return envTex;
}

// the scales: panels of clear chrome. See-through where they face you (the violet body and its
// veins show under them), mirror at the edges, and a film of rainbow over them that slides as
// they turn
function chromeMaterial() {
	const m = new THREE.MeshPhysicalMaterial({
		color: 0xe6e2ff, metalness: 1, roughness: 0.06, envMap: chromeEnvironment(), envMapIntensity: 1.6,
		iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [160, 680],
		emissive: 0x2a1a70, emissiveIntensity: 0.3, transparent: true, premultipliedAlpha: true, flatShading: true,
	});
	m.onBeforeCompile = (sh) => {
		sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{
		float edge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
		vec3 spectrum = 0.5 + 0.5 * cos(6.2832 * (edge * 1.6 + vec3(0.0, 0.33, 0.67)));
		outgoingLight += spectrum * pow(edge, 1.6) * 0.7;
		diffuseColor.a = mix(0.22, 0.97, pow(edge, 1.3));
	}
	#include <opaque_fragment>`)
			// (the light it reflects is added whole over what shows through, as on glass: the
			// alpha only says how much of the body behind is hidden)
			.replace('#include <premultiplied_alpha_fragment>', '');
	};
	m.customProgramCacheKey = () => 'leviathan-chrome';
	return m;
}

// the tube's paint: deep violet crystal, the underside lit by veins of blue light that pulse
function bodyMaterial() {
	const m = new THREE.MeshStandardMaterial({ color: 0x5a46a8, roughness: 0.25, metalness: 0.15, flatShading: true });
	const glow = { value: 1 }, time = { value: 0 };
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uGlow = glow; sh.uniforms.uTime = time;
		sh.vertexShader = 'attribute vec2 aBand;\nvarying vec2 vBand;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBand = aBand;');
		sh.fragmentShader = 'uniform float uGlow;\nuniform float uTime;\nvarying vec2 vBand;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		// (vBand.x along the body, vBand.y round it: 0 the top, 0.5 the belly)
		float belly = smoothstep(0.22, 0.42, 0.5 - abs(vBand.y - 0.5));
		float rib = pow(0.5 + 0.5 * sin(vBand.x * 9.0), 6.0);
		float vein = pow(0.5 + 0.5 * sin(vBand.x * 2.3 + vBand.y * 40.0 + sin(vBand.x * 1.7) * 2.0), 18.0);
		float pulse = 0.6 + 0.4 * sin(uTime * 2.5 - vBand.x * 0.8);
		totalEmissiveRadiance += vec3(0.35, 0.5, 1.0) * belly * (rib * 0.8 + vein * 1.6 + 0.15) * pulse * uGlow;
	}`);
	};
	m.customProgramCacheKey = () => 'leviathan-body';
	m.userData = { glow, time };
	return m;
}

// the head: skull, jaw on its hinge, teeth, eyes, the brow's third eye and the crown
function makeHead(M, phone) {
	const head = new THREE.Group();
	const skull = new THREE.Mesh(new ConvexGeometry(both([
		[0, 0.25, 1.78], [0.18, 0.12, 1.72], [0.22, 0.46, 1.32], [0, 0.6, 1.1],
		[0.62, 0.86, 0.35], [0, 0.98, 0.55], [0, 1.12, -0.3], [0.56, 0.96, -0.4],
		[0.45, 0.55, -1.0], [0, 0.78, -1.05], [0.82, 0.22, -0.1], [0.72, 0.4, 0.55],
		[0.3, -0.04, 1.45], [0.6, -0.04, 0.3], [0.55, -0.1, -0.5], [0, -0.12, -0.9],
	])), M.skull);
	head.add(skull);
	// the jaw, hinged at the back of the skull
	const jaw = new THREE.Group();
	jaw.position.set(0, -0.05, -0.45);
	head.add(jaw);
	const J = (x, y, z) => [x, y + 0.05, z + 0.45];
	jaw.add(new THREE.Mesh(new ConvexGeometry(both([
		J(0.26, -0.1, 1.38), J(0, -0.32, 1.42), J(0.55, -0.1, 0.2), J(0.5, -0.15, -0.5),
		J(0.36, -0.5, 0.1), J(0, -0.58, 0.6), J(0, -0.46, -0.4),
	])), M.skull));
	// (the mouth's dark, seen when it opens)
	const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), M.mouth);
	mouth.rotation.x = -Math.PI / 2; mouth.position.set(0, -0.06, 0.75);
	head.add(mouth);
	// teeth along both jaws
	const tooth = new THREE.ConeGeometry(0.055, 0.26, 4);
	const nt = 9, teeth = new THREE.InstancedMesh(tooth, M.tooth, nt * 2), low = new THREE.InstancedMesh(tooth, M.tooth, nt * 2);
	const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
	for (let i = 0; i < nt; i++) {
		const u = i / (nt - 1), z = 1.4 - u * 1.15, x = 0.27 + u * 0.33, k = 1 - Math.abs(u - 0.25) * 0.6;
		for (const [j, sx] of [[0, 1], [1, -1]]) {
			_q.setFromAxisAngle(V(1, 0, 0), Math.PI);
			teeth.setMatrixAt(i * 2 + j, _m.compose(V(sx * x, -0.12, z), _q, _s.setScalar(k)));
			low.setMatrixAt(i * 2 + j, _m.compose(V(sx * (x - 0.03), 0.06 - 0.12, z - 0.05 + 0.45), _q.identity(), _s.setScalar(k * 0.85)));
		}
	}
	head.add(teeth); jaw.add(low);
	// eyes: two slits, and the third in the brow
	const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf2eaff, emissive: 0xb88cff, emissiveIntensity: 2.2, roughness: 0.2 });
	for (const sx of [1, -1]) {
		const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), eyeMat);
		e.scale.set(1.8, 0.7, 0.8); e.position.set(sx * 0.5, 0.64, 0.8); e.rotation.set(0, sx * 0.5, sx * -0.35);
		head.add(e);
	}
	const brow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), eyeMat);
	brow.scale.set(0.85, 1.35, 0.45); brow.position.set(0, 0.88, 0.66); brow.rotation.x = -0.6;
	head.add(brow);
	const browSet = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), M.spike);
	browSet.scale.set(0.7, 1.15, 0.3); browSet.position.set(0, 0.86, 0.6); browSet.rotation.x = -0.6;
	head.add(browSet);
	// the crown: rows of crystal spikes from the brow back over the skull, swept back, the
	// longest at the back; more from the cheeks
	const geo = crystalGeometry(), crown = [];
	const spike = (at, dir, len, w) => crown.push({ at: V(...at), dir: V(...dir).normalize(), len, w });
	for (let i = 0; i < 7; i++) {
		const a = (i - 3) / 3;
		spike([a * 0.5, 0.95 - Math.abs(a) * 0.15, 0.2], [a * 0.9, 1, -0.55], 1.0 - Math.abs(a) * 0.25, 0.12);
		spike([a * 0.55, 0.9 - Math.abs(a) * 0.2, -0.35], [a * 1.0, 1, -1.0], 1.55 - Math.abs(a) * 0.4, 0.15);
		spike([a * 0.5, 0.7 - Math.abs(a) * 0.15, -0.85], [a * 1.0, 0.6, -1.2], 1.75 - Math.abs(a) * 0.5, 0.15);
	}
	// (a ridge of small ones down the snout, and spurs under the jaw's hinge)
	for (let i = 0; i < 4; i++) spike([0, 0.62 - i * 0.04 + i * 0.1, 1.15 - i * 0.22], [0, 1, -0.9], 0.28 + i * 0.07, 0.06);
	for (const sx of [1, -1]) {
		for (let i = 0; i < 2; i++) spike([sx * (0.45 + i * 0.1), -0.25, -0.3 - i * 0.3], [sx * 0.6, -0.5, -1], 0.5 + i * 0.15, 0.07);
		for (let i = 0; i < 3; i++) spike([sx * 0.78, 0.32 - i * 0.12, 0.3 - i * 0.35], [sx * 1.1, 0.35 - i * 0.2, -1], 0.7 + i * 0.15, 0.09);
		spike([sx * 0.62, 0.88, 0.45], [sx * 0.6, 0.7, -0.8], 0.55, 0.08);
	}
	const cm = new THREE.InstancedMesh(geo, M.spike, crown.length);
	const _y = V(0, 1, 0);
	crown.forEach((c, i) => {
		_q.setFromUnitVectors(_y, c.dir);
		cm.setMatrixAt(i, _m.compose(c.at, _q, _s.set(c.w * 1.3, c.len * 1.45, c.w * 1.3)));
	});
	head.add(cm);
	for (const m of [skull, cm, teeth]) m.castShadow = !phone;
	return { head, jaw, eyeMat, brow };
}

// the breastplate at the base of the neck: a shield under the throat and a pauldron each side
function makePlate(M) {
	const g = new THREE.Group();
	const shield = new THREE.Mesh(new ConvexGeometry(both([
		[0, 0, 0.9], [0.55, 0.15, 0.55], [0.85, 0.5, 0], [0.6, 0.35, -0.7], [0, 0.1, -0.95],
		[0, 0.3, 0.75], [0.45, 0.42, 0.45], [0.7, 0.72, 0], [0.48, 0.6, -0.6], [0, 0.35, -0.8],
	])), M.plate);
	shield.position.set(0, -0.22, 0); shield.rotation.z = Math.PI;
	g.add(shield);
	for (const sx of [1, -1]) {
		const p = new THREE.Mesh(new ConvexGeometry(both([
			[0, 0, 0.75], [0.5, 0.2, 0.4], [0.7, 0.5, -0.2], [0.35, 0.4, -0.75], [0, 0.25, -0.6], [0, 0.6, 0.2], [0.4, 0.72, -0.2],
		])), M.plate);
		p.position.set(sx * 0.55, 0.42, 0.05); p.rotation.set(0, 0, sx * -0.75);
		g.add(p);
		// (a spur off each, swept back, as drawn)
		const s = new THREE.Mesh(crystalGeometry(), M.spike);
		s.position.set(sx * 1.0, 0.85, -0.3); s.quaternion.setFromUnitVectors(V(0, 1, 0), V(sx * 0.9, 0.5, -1).normalize()); s.scale.set(0.12, 0.9, 0.12);
		g.add(s);
	}
	return g;
}

export function leviathanBody({ n, radii, phone = false }) {
	const M = materials(), body = bodyMaterial();
	const group = new THREE.Group();
	// ---- the tube ----
	const RING = phone ? 8 : 12, PER = phone ? 3 : 6, rings = (n - 1) * PER + 1;
	const pos = new Float32Array(rings * (RING + 1) * 3), band = new Float32Array(rings * (RING + 1) * 2);
	const idx = [];
	for (let r = 0; r < rings; r++) for (let k = 0; k <= RING; k++) { const o = (r * (RING + 1) + k) * 2; band[o] = r / (rings - 1) * (n - 1) * 1.3; band[o + 1] = k / RING; }
	for (let r = 0; r < rings - 1; r++) for (let k = 0; k < RING; k++) {
		const a = r * (RING + 1) + k, b = a + RING + 1;
		idx.push(a, b, a + 1, a + 1, b, b + 1);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aBand', new THREE.BufferAttribute(band, 2));
	geo.setIndex(idx);
	const tube = new THREE.Mesh(geo, body);
	tube.frustumCulled = false; tube.castShadow = !phone; tube.receiveShadow = true;
	group.add(tube);
	// the radius along it: as thick as the drawing at the neck, full through the chest, tapering
	// down the long tail to a point
	const Rmax = Math.max(...radii) * 0.6;
	const rad = (u) => Rmax * (u < 0.2 ? 0.78 + 0.22 * Math.sin(u / 0.2 * Math.PI / 2) : u < 0.5 ? 1 : 1 - Math.pow((u - 0.5) / 0.5, 1.3) * 0.9);
	// ---- the scales ----
	const PL = phone ? 8 : 13, step = 1;
	const scaleRows = Math.ceil(rings / step);
	const scales = new THREE.InstancedMesh(crystalGeometry(), M.scale, scaleRows * PL + scaleRows);
	scales.frustumCulled = false; scales.castShadow = !phone;
	group.add(scales);
	// ---- head and plate ----
	const H = makeHead(M, phone);
	group.add(H.head);
	const plate = makePlate(M);
	group.add(plate);
	const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9a7cff, emissiveIntensity: 0.3, roughness: 0.2 }));
	group.add(heart);
	const heartLight = phone ? null : new THREE.PointLight(0x9a7cff, 0, 14, 2);
	if (heartLight) group.add(heartLight);

	const C = new THREE.CatmullRomCurve3([], false, 'centripetal');
	const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _sd = new THREE.Vector3(), _up = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3();
	const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), WY = V(0, 1, 0);
	// the frame at u: centre, tangent (toward the tail), side and up
	function frame(u) {
		C.getPointAt(u, _c);
		C.getTangentAt(u, _t);
		_sd.crossVectors(WY, _t);
		if (_sd.lengthSq() < 1e-6) _sd.set(1, 0, 0);
		_sd.normalize();
		_up.crossVectors(_t, _sd).normalize();
	}
	let phase = -1, burst = false;
	function update(points, t, { jaw = 0, phase: ph = 0, glow = 1, cracked = 0 } = {}) {
		C.points = points;
		C.updateArcLengths();
		body.userData.time.value = t;
		body.userData.glow.value = glow;
		// the tube
		for (let r = 0; r < rings; r++) {
			const u = r / (rings - 1);
			frame(u);
			// (the tail tapers to a point, the neck swells a little at the plate)
			const R = rad(u);
			for (let k = 0; k <= RING; k++) {
				const a = (k / RING) * TAU, ca = Math.cos(a), sa = Math.sin(a);
				const o = (r * (RING + 1) + k) * 3;
				// (round over the top, a little flat beneath)
				const ry = ca > 0 ? 1 : 0.82;
				pos[o] = _c.x + (_up.x * ca * ry + _sd.x * sa) * R;
				pos[o + 1] = _c.y + (_up.y * ca * ry + _sd.y * sa) * R;
				pos[o + 2] = _c.z + (_up.z * ca * ry + _sd.z * sa) * R;
			}
		}
		geo.attributes.position.needsUpdate = true;
		geo.computeVertexNormals();
		// the scales: a row a ring, over the top and down the flanks, each leaning back
		let i = 0;
		for (let r = 0; r < rings; r += step) {
			const u = r / (rings - 1);
			frame(u);
			const R = rad(u);
			for (let k = 0; k < PL; k++) {
				const a = ((k + ((r / step) % 2) * 0.5) / (PL - 1) - 0.5) * 3.9;
				_n.copy(_up).multiplyScalar(Math.cos(a)).addScaledVector(_sd, Math.sin(a)).normalize();
				_x.copy(_c).addScaledVector(_n, R * 0.82);
				_d.copy(_n).multiplyScalar(0.32).addScaledVector(_t, 1).normalize();
				const len = R * (0.62 - Math.abs(a) * 0.06), w = len * 0.8;
				// (flat to the body: its thin side along the normal)
				_z.crossVectors(_d, _n).normalize();
				_b.makeBasis(_z, _d, _s.crossVectors(_z, _d));
				_q.setFromRotationMatrix(_b);
				scales.setMatrixAt(i++, _m.compose(_x, _q, _s.set(w, len, w * 0.35)));
			}
			// the spine on the ridge
			_x.copy(_c).addScaledVector(_up, R * 0.9);
			_d.copy(_up).multiplyScalar(0.9).addScaledVector(_t, 1).normalize();
			_q.setFromUnitVectors(WY, _d);
			const sl = R * (r % (step * 2) ? 0.9 : 1.35);
			scales.setMatrixAt(i++, _m.compose(_x, _q, _s.set(sl * 0.2, sl, sl * 0.2)));
		}
		scales.count = i;
		scales.instanceMatrix.needsUpdate = true;
		// the head on the first point, looking along the way it goes
		frame(0);
		const r0 = rad(0);
		H.head.position.copy(_c).addScaledVector(_t, -r0 * 0.3).addScaledVector(_up, -r0 * 0.25);
		_z.copy(_t).negate();
		_x.crossVectors(_up, _z).normalize();
		_b.makeBasis(_x, _s.crossVectors(_z, _x), _z);
		H.head.quaternion.setFromRotationMatrix(_b);
		H.head.scale.setScalar(Rmax * 1.25);
		H.jaw.rotation.x = jaw * 0.75;
		// the plate and the heart under it, at the base of the neck
		const up = 2.4 / (n - 1);
		frame(up);
		const rp = rad(up);
		plate.position.copy(_c);
		_z.copy(_t).negate();
		_x.crossVectors(_up, _z).normalize();
		_b.makeBasis(_x, _s.crossVectors(_z, _x), _z);
		plate.quaternion.setFromRotationMatrix(_b);
		plate.scale.setScalar(rp * 1.05);
		heart.position.copy(_c).addScaledVector(_up, -rp * (ph >= 2 ? 0.8 : 0.5)).addScaledVector(_t, -rp * 0.1);
		heart.rotation.y = t * 1.5;
		// the turn of the fight: dark and cracked, then the plate gone and the heart blazing
		if (ph !== phase) {
			phase = ph;
			const dark = ph >= 1;
			M.spike.color.set(dark ? 0x2e2a3c : 0xb9a9ef); M.spike.emissive.set(dark ? 0x3a0c2a : 0x4a2aa0);
			M.plate.color.set(dark ? 0x6c6488 : 0xcfc6f4); M.plate.emissive.set(dark ? 0x8a2a9a : 0x4a3aa8);
			H.eyeMat.emissive.set(dark ? 0xff2a6a : 0xc8b4ff);
		}
		M.plate.emissiveIntensity = ph >= 1 ? 0.5 + cracked * (0.5 + 0.5 * Math.sin(t * 7)) : 0.45;
		const bare = ph >= 2;
		plate.visible = !bare;
		const beat = 0.5 + 0.5 * Math.sin(t * 6);
		heart.material.emissiveIntensity = bare ? 3 + beat * 2 : ph >= 1 ? 0.8 + beat * 0.6 : 0.2;
		heart.scale.setScalar(rp * (bare ? 0.75 + beat * 0.1 : 0.4));
		if (heartLight) { heartLight.position.copy(heart.position); heartLight.intensity = bare ? 6 + beat * 4 : ph >= 1 ? 1 : 0; }
		const fresh = bare && !burst;
		if (bare) burst = true;
		return { head: H.head, brow: H.brow, plateBurst: fresh ? plate.position : null };
	}
	return { group, update, heart, plate, eyeMat: H.eyeMat, brow: H.brow, head: H.head, radius: rad };
}
