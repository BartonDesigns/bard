import * as THREE from 'three';
import { signMaterial, syncSignageMaterials, SIGN_U } from '../src/signage/materials.js';
import { createBatch } from '../src/signage/batch.js';
import { setTier } from '../src/world/governor.js';

export function addSigns(scene) {
	setTier(0);
	const texture = new THREE.DataTexture(new Uint8Array([220, 180, 60, 255]), 1, 1); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
	const kinds = ['retro', 'vinyl', 'glass', 'paper', 'foil', 'paint', 'grime', 'cloth'];
	for (let i = 0; i < kinds.length; i++) {
		const b = createBatch(scene, kinds[i], 3, texture, 1);
		b.put(55590 + (i % 4 - 1.5) * 2, 174 + (i < 4 ? 1 : -1), -945, 0, 0, 1, 1, 0, 0, 1.7, 1.7, [0, 0, 1, 1], 0, .3, .25, 0); b.commit();
	}
	scene.add(new THREE.HemisphereLight(0xffffff, 0x443322, 2));
	return texture;
}

export async function compileSigns() {
	const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(320, 240); document.body.append(renderer.domElement);
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, 320 / 240, .1, 1000); scene.fog = new THREE.Fog(0x334455, 40, 300);
	camera.position.set(55590, 174, -940); camera.lookAt(55590, 174, -945);
	const source = [], gl = renderer.getContext(), shaderSource = gl.shaderSource.bind(gl);
	gl.shaderSource = (s, code) => { source.push(code); shaderSource(s, code); };
	addSigns(scene); renderer.render(scene, camera);
	const full = source.reduce((n, s) => Math.max(n, s.length), 0); source.length = 0;
	setTier(3); syncSignageMaterials(scene); renderer.render(scene, camera);
	const lite = source.reduce((n, s) => Math.max(n, s.length), 0);
	const pixel = new Uint8Array(4); gl.readPixels(125, 160, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	const geo = new THREE.PlaneGeometry(2, 2); geo.setAttribute('aCell', new THREE.Float32BufferAttribute([0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1], 4)); geo.setAttribute('aFx', new THREE.Float32BufferAttribute([0,.3,.2,0,0,.3,.2,0,0,.3,.2,0,0,.3,.2,0], 4));
	const probe = new THREE.Scene(), texture = scene.children.find(m => m.material?.map)?.material.map;
	const sign = new THREE.Mesh(geo, signMaterial('retro', 3, texture)); sign.position.set(55590,174,-945); probe.add(sign);
	const sample = () => { renderer.render(probe, camera); gl.readPixels(160,120,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel); return [...pixel]; };
	SIGN_U.uSgDay.value = 0; SIGN_U.uSgAmbient.value.setRGB(.002,.002,.002); SIGN_U.uSgHead.value.set(55590,174,-940,0);
	const dark = sample(); SIGN_U.uSgHeadDir.value.set(0,0,-1); SIGN_U.uSgHead.value.w=1; const headlit=sample(); sign.rotation.y=Math.PI; const back=sample();
	const result = { full, lite, dark, headlit, back, programs: renderer.info.programs.length, lost: gl.isContextLost(), compact: scene.children.filter(m => m.material?.isShaderMaterial).length };
	renderer.dispose(); renderer.forceContextLoss(); return result;
}
