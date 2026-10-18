// The sky in what people wear: an outdoor environment for the one material all their kit
// shares (garment.js accessoryMaterial), so steel, lenses and polished edges have something to
// reflect. The world has no environment of its own (its sky is drawn, not lit from), and the
// held items light only their own view (crysis/viewmodel.js), so without this armour can only
// be lit by the scene's lamps and reads as grey plastic. A pale sky above a bright horizon and
// a dark ground, with the sun's disc in it, made once into a prefiltered map; its strength
// follows the day (the world's sun and sky light), dimmed indoors and underground. Only the
// reflections are taken from it: the scene's own lights still light the rest (propkit.js).
import * as THREE from 'three';
import { accessoryMaterial } from './garment.js';

let env = null, tried = false;
// other materials that take the same sky (a gauntlet seen through your own eyes, sleeve.js)
const shared = new Set();
export function kitShare(m) {
	shared.add(m);
	m.addEventListener('dispose', () => shared.delete(m));
}
// the sky as a little scene: a dome with its colours in its vertices, and the sun
function skyScene() {
	const scene = new THREE.Scene();
	const g = new THREE.SphereGeometry(10, 48, 24), pa = g.attributes.position, col = new Float32Array(pa.count * 3);
	const zen = new THREE.Color('#6f93c2'), hor = new THREE.Color('#e9eef0'), grd = new THREE.Color('#4d463c'), low = new THREE.Color('#2a2621'), c = new THREE.Color();
	for (let i = 0; i < pa.count; i++) {
		const y = pa.getY(i) / 10;
		if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.55));
		else c.copy(grd).lerp(low, Math.min(1, -y * 1.6));
		col.set([c.r, c.g, c.b], i * 3);
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
	const sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 7) }));
	sun.position.set(4, 6.5, -5).setLength(9);
	scene.add(sun);
	return scene;
}
export function kitEnvironment(renderer) {
	if (env || tried) return env;
	tried = true;
	try {
		const pm = new THREE.PMREMGenerator(renderer), s = skyScene();
		// (128 a side is plenty for a sky this soft: 384 by 512 half floats, 1.6 MB on the GPU)
		env = pm.fromScene(s, 0.02, 0.1, 100, { size: 128 }).texture;
		pm.dispose();
		s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
	} catch { env = null; }
	return env;
}
// each frame: sky = the world's (its sun and hemisphere lights), shade 0..1 (1 in the open)
export function kitDaylight(renderer, sky = null, shade = 1) {
	const e = kitEnvironment(renderer), m = accessoryMaterial();
	if (!e) return;
	if (m.envMap !== e) { m.envMap = e; m.needsUpdate = true; }
	const sun = sky?.sun, hemi = sky?.hemi;
	const day = sun || hemi ? Math.min(1, Math.max(0, ((sun && sun.visible !== false ? sun.intensity : 0) * 0.3 + (hemi?.intensity ?? 1) * 0.6) / 1.6)) : 1;
	m.envMapIntensity = (0.12 + day * 0.88) * Math.max(0.15, shade);
	for (const x of shared) { if (x.envMap !== e) { x.envMap = e; x.needsUpdate = true; } x.envMapIntensity = m.envMapIntensity; }
}
