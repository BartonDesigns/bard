import * as THREE from 'three';
import { createSeaMirror } from '../src/world/seamirror.js';
import { createSeaDepth } from '../src/world/seadepth.js';
import { setTier } from '../src/world/governor.js';
import { meterGL } from '../src/world/gpumeter.js';

export async function reflectionPressure() {
	setTier(0);
	const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(640, 480);
	const meter = meterGL(renderer.getContext()), scene = new THREE.Scene(), land = new THREE.Group(), hidden = new THREE.Group();
	scene.add(land, hidden); hidden.visible = false;
	const camera = new THREE.PerspectiveCamera(70, 4 / 3, .1, 100); camera.position.set(0, 3, 6); camera.lookAt(0, 0, 0);
	const geo = new THREE.BoxGeometry();
	for (let i = 0; i < 44; i++) {
		const mat = new THREE.MeshBasicMaterial({ color: 0x669933 }); mat.defines = { PRESSURE_VARIANT: i };
		const mesh = new THREE.Mesh(geo, mat); mesh.position.set((i % 4 - 1.5) * .6, 1, 0);
		(i < 4 ? land : hidden).add(mesh);
	}
	const mirror = createSeaMirror(renderer), depth = createSeaDepth(renderer), batches = [];
	const compile = renderer.compile.bind(renderer);
	renderer.compile = (root, ...rest) => { const materials = compile(root, ...rest); batches.push(materials.size); return materials; };
	try {
		for (let i = 0; i < 120 && !mirror.uniforms.uReflOn.value; i++) {
			mirror.render(scene, camera, [land]); await new Promise(r => setTimeout(r, 20));
		}
		if (!mirror.uniforms.uReflOn.value) throw Error('Mirror did not finish bounded warm-up');
		depth.mark(land); depth.render(scene, camera);
		const bounded = { batches: [...batches], programs: renderer.info.programs.length, bytes: meter.info() };
		// Exact old API behavior: compile(scene) visits every hidden material too.
		renderer.setRenderTarget(mirror.target); const fullCount = compile(scene, mirror.camera).size; renderer.setRenderTarget(null);
		const allPrograms = renderer.info.programs.length;
		setTier(2); mirror.render(scene, camera, [land]); depth.render(scene, camera);
		const released = { bytes: meter.info(), mirror: mirror.target.width, depth: depth.target.width,
			mirrorBound: !!mirror.uniforms.uRefl.value, depthBound: !!depth.uniforms.uSeaDepth.value };
		return { bounded, fullCount, allPrograms, released, lost: renderer.getContext().isContextLost() };
	} finally {
		mirror.dispose(); depth.dispose(); geo.dispose(); scene.traverse(o => o.material?.dispose());
		renderer.dispose(); renderer.forceContextLoss(); setTier(0);
	}
}
