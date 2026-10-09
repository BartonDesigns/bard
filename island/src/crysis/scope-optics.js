// A bounded two-camera optic. The small rear target reflects the actual scene behind the
// player; the forward target supplies the aiming image. No cube cameras or static backdrop.
import * as THREE from 'three';

const glassState = new WeakMap();
const SUPPORTED = new Set(['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine']);

export function attachScopeGlass(material, { dot = false, rear = true } = {}) {
	const uniforms = {
		scopeForward: { value: null }, scopeRear: { value: null },
		scopeForwardReady: { value: 0 }, scopeRearReady: { value: 0 },
		scopeAim: { value: 0 }, scopeDot: { value: dot ? 1 : 0 },
	};
	material.userData.scopeGlass = { dot, rear };
	glassState.set(material, uniforms);
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vScopeUv;')
			.replace('#include <uv_vertex>', '#include <uv_vertex>\nvScopeUv = uv;');
		shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D scopeForward;
uniform sampler2D scopeRear;
uniform float scopeForwardReady;
uniform float scopeRearReady;
uniform float scopeAim;
uniform float scopeDot;
varying vec2 vScopeUv;
`)
			.replace('#include <opaque_fragment>', `
	vec2 lens = vScopeUv - 0.5;
	float glassFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
	float fresnel = pow(1.0 - glassFacing, 3.0);
	float aperture = 1.0 - smoothstep(0.42, 0.5, length(lens));
	float imageAmount = scopeForwardReady * scopeAim * (1.0 - scopeDot) * aperture;
	// Mild lens distortion is confined to the edge; target centre and reticle stay aligned.
	vec2 forwardUV = 0.5 + lens * (1.0 + 0.055 * dot(lens, lens));
	vec3 target = texture2D(scopeForward, clamp(forwardUV, 0.001, 0.999)).rgb;
	outgoingLight = mix(outgoingLight, target * vec3(0.985, 1.0, 0.992), imageAmount);
	// Reflected rear image is horizontally mirrored. Reflection strengthens at grazing angles
	// and stays subtle during aiming, so the sight remains useful against a bright background.
	vec2 rearUV = vec2(1.0 - vScopeUv.x, vScopeUv.y) + lens * dot(lens, lens) * 0.13;
	vec3 behind = texture2D(scopeRear, clamp(rearUV, 0.001, 0.999)).rgb;
	float reflection = scopeRearReady * (0.055 + 0.24 * fresnel) * mix(1.0, 0.58, scopeAim) * aperture;
	outgoingLight = mix(outgoingLight, behind * vec3(0.82, 0.96, 1.0), reflection);
	outgoingLight += totalEmissiveRadiance * imageAmount;
	diffuseColor.a = max(diffuseColor.a, imageAmount);
	#ifdef USE_EMISSIVEMAP
		diffuseColor.a = max(diffuseColor.a, texture2D(emissiveMap, vEmissiveMapUv).g * 0.95);
	#endif
	#include <opaque_fragment>`);
	};
	material.customProgramCacheKey = () => 'live-scope-2';
	material.needsUpdate = true;
	return material;
}

export function createScopeOptics({ renderer, scene, camera, phone = false }) {
	const size = phone ? { forward: 256, rear: 64 } : { forward: 384, rear: 128 };
	let forward = null, rear = null, bound = null, busy = false, disposed = false;
	let forwardAt = -Infinity, rearAt = -Infinity;
	const links = [], stats = { forwardFrames: 0, rearFrames: 0, active: false, aiming: false, item: null };
	const frontCam = new THREE.PerspectiveCamera(), rearCam = new THREE.PerspectiveCamera();
	const pos = new THREE.Vector3(), q = new THREE.Quaternion();
	const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
	const lastRearPos = new THREE.Vector3(Infinity, 0, 0), lastRearQ = new THREE.Quaternion();
	const viewport = new THREE.Vector4(), scissor = new THREE.Vector4();
	function target(n) {
		const result = new THREE.WebGLRenderTarget(n, n, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
		result.texture.generateMipmaps = false;
		result.texture.colorSpace = THREE.LinearSRGBColorSpace;
		return result;
	}
	function clearBinding() {
		for (const link of links) { link.mesh.material = link.original; link.material.dispose(); }
		links.length = 0; bound = null;
	}
	function reset() {
		clearBinding();
		forward?.dispose(); rear?.dispose(); forward = rear = null;
		forwardAt = rearAt = -Infinity;
		stats.active = stats.aiming = false; stats.item = null;
	}
	function bind(item) {
		clearBinding(); bound = item;
		item.traverse((mesh) => {
			const original = mesh.material, config = original?.userData?.scopeGlass;
			if (!config || !mesh.isMesh) return;
			const material = attachScopeGlass(original.clone(), config);
			mesh.material = material;
			links.push({ mesh, original, material, config, uniforms: glassState.get(material) });
		});
		forwardAt = rearAt = -Infinity;
	}
	function cameraAt(out, backwards) {
		out.position.copy(pos); out.quaternion.copy(q);
		if (backwards) out.quaternion.multiply(flip);
		out.near = Math.max(0.1, camera.near || 0.1); out.far = camera.far || 10000;
		// The main world's ADS zoom already supplies part of the magnification. Read the
		// effective FOV so a scope remains centred with any gameplay zoom / phone aspect.
		const fov = camera.getEffectiveFOV ? camera.getEffectiveFOV() : camera.fov || 60;
		out.fov = backwards ? 88 : THREE.MathUtils.clamp(fov / 2.4, 10, 32);
		out.aspect = 1; out.zoom = 1; out.layers.mask = camera.layers.mask;
		out.updateProjectionMatrix(); out.updateMatrixWorld(true);
	}
	function capture(to, withCamera) {
		const previous = {
			target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace?.() || 0, mip: renderer.getActiveMipmapLevel?.() || 0,
			autoClear: renderer.autoClear, xr: renderer.xr?.enabled, tone: renderer.toneMapping,
			shadowAuto: renderer.shadowMap.autoUpdate, shadowNeeds: renderer.shadowMap.needsUpdate,
			scissorTest: renderer.getScissorTest(), visible: bound.visible,
		};
		renderer.getViewport(viewport); renderer.getScissor(scissor);
		try {
			// Exclude the held mesh if it is attached to the world scene. The viewmodel
			// normally lives in a separate scene, so this also prevents future recursion.
			bound.visible = false;
			if (renderer.xr) renderer.xr.enabled = false;
			renderer.autoClear = true; renderer.toneMapping = THREE.NoToneMapping;
			renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
			renderer.setRenderTarget(to); renderer.setViewport(0, 0, to.width, to.height);
			renderer.setScissorTest(false); renderer.clear(true, true, true); renderer.render(scene, withCamera);
		} finally {
			bound.visible = previous.visible;
			renderer.setRenderTarget(previous.target, previous.face, previous.mip);
			renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(previous.scissorTest);
			renderer.autoClear = previous.autoClear; renderer.toneMapping = previous.tone;
			renderer.shadowMap.autoUpdate = previous.shadowAuto; renderer.shadowMap.needsUpdate = previous.shadowNeeds;
			if (renderer.xr) renderer.xr.enabled = previous.xr;
		}
	}
	function moved(position, rotation) { return position.distanceToSquared(pos) > 0.0004 || 1 - Math.abs(rotation.dot(q)) > 0.000002; }
	function update({ item, aiming = false, active = true, time = performance.now() / 1000 } = {}) {
		if (disposed || busy) return;
		if (!active || !item || !SUPPORTED.has(item.userData?.id) || !scene || !camera) { if (bound || forward || rear) reset(); return; }
		if (item !== bound) bind(item);
		if (!links.length) { reset(); return; }
		stats.active = true; stats.item = item.userData.id;
		const aim = Math.max(0, Math.min(1, Number(aiming))); stats.aiming = aim > 0.5;
		camera.updateWorldMatrix(true, false); camera.getWorldPosition(pos); camera.getWorldQuaternion(q);
		const hasScope = links.some(link => link.config.rear && !link.config.dot);
		busy = true;
		try {
			if (!rear) rear = target(size.rear);
			const rearGap = phone ? 1 / 3 : 0.15;
			if (time - rearAt >= rearGap && (moved(lastRearPos, lastRearQ) || time - rearAt > 0.8)) {
				cameraAt(rearCam, true); capture(rear, rearCam); rearAt = time;
				lastRearPos.copy(pos); lastRearQ.copy(q); stats.rearFrames++;
			}
			if (aim > 0.05 && hasScope) {
				if (!forward) forward = target(size.forward);
				if (time - forwardAt >= (phone ? 1 / 8 : 1 / 15)) {
					cameraAt(frontCam, false); capture(forward, frontCam); forwardAt = time;
					stats.forwardFrames++;
				}
			}
			for (const link of links) {
				// Reflective materials are private to this held instance. Gear previews and
				// NPCs retain their original static materials and never inherit a camera feed.
				if (link.material.envMap !== link.original.envMap) { link.material.envMap = link.original.envMap; link.material.needsUpdate = true; }
				link.material.envMapIntensity = link.original.envMapIntensity;
				const u = link.uniforms;
				u.scopeRear.value = rear.texture; u.scopeRearReady.value = Number(Number.isFinite(rearAt));
				u.scopeForward.value = forward?.texture || rear.texture;
				u.scopeForwardReady.value = Number(link.config.rear && Number.isFinite(forwardAt));
				u.scopeAim.value = aim;
			}
		} finally { busy = false; }
	}
	return {
		update, reset,
		dispose() { reset(); disposed = true; },
		diagnostics() { return { ...stats, sizes: { ...size }, lenses: links.length, targets: Number(!!forward) + Number(!!rear) }; },
	};
}
