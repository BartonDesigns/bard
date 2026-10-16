// A small room lit by interiors/lighting.js, drawn once in a real WebGL context, for
// island/tools/lighting-shader-browser.cjs: every kind of material its copies are made of
// must compile (standard with and without the gleam, lambert, phong, a lamp, a glowing world).
import * as THREE from 'three';
import { bakeNow, configureLighting } from '../src/interiors/lighting.js';

const out = { errors: [] };
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(320, 200);
renderer.shadowMap.enabled = true;
renderer.debug.onShaderError = (gl, program, vs, fs) => { out.errors.push(gl.getProgramInfoLog(program) + ' | ' + gl.getShaderInfoLog(fs) + ' | ' + gl.getShaderInfoLog(vs)); };
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
scene.add(sun);
const camera = new THREE.PerspectiveCamera(70, 1.6, 0.1, 100);
camera.position.set(0, 0, 1.2);
function room(kind, x, opts = {}) {
	const g = new THREE.BoxGeometry(4, 3, 4).toNonIndexed();
	const n = g.attributes.normal;
	for (let i = 0; i < n.array.length; i++) n.array[i] *= -1;
	const M = kind === 'lambert' ? THREE.MeshLambertMaterial : kind === 'phong' ? THREE.MeshPhongMaterial : THREE.MeshStandardMaterial;
	const m = new M({ color: 0xcccccc, side: THREE.BackSide, vertexColors: false });
	const lm = new THREE.MeshStandardMaterial({ emissive: 0xffeecc });
	const r = new THREE.Group();
	const a = new THREE.Mesh(g, m); a.name = 'paint'; a.receiveShadow = true;
	const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.15).translate(0, 1.4, 0).toNonIndexed(), lm); l.name = 'lamp';
	r.add(a, l);
	r.position.x = x;
	scene.add(r);
	return bakeNow(r, { id: kind + x, levels: [[-1.5, 1.5]], ...opts });
}
configureLighting({ isPhone: false });
const hs = [room('standard', 0), room('lambert', 6), room('phong', 12), room('standard', 18, { emissive: true })];
for (let i = 0; i < 3; i++) renderer.render(scene, camera);
await new Promise((r) => setTimeout(r, 50));
for (let i = 0; i < 3; i++) renderer.render(scene, camera);
out.programs = renderer.info.programs.length;
out.lights = scene.children.filter((o) => o.isPointLight).length;
out.fixtures = hs.map((H) => H.fixtures.length);
// what the fixtures put on the walls, and the room's middle as drawn (it must not be black)
let mx = 0;
hs[0].root.traverse((o) => { const A = o.isMesh && o.geometry.attributes.ilight; if (A && o.name === 'paint') for (let i = 0; i < A.count; i++) mx = Math.max(mx, A.getX(i)); });
out.wallLight = +(mx * 64).toFixed(2);
const px = new Uint8Array(4);
const gl = renderer.getContext();
gl.readPixels(160, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
out.centre = [...px];
if (px[0] + px[1] + px[2] < 30) out.errors.push('the lit room drew black');
out.image = renderer.domElement.toDataURL('image/png');
window.RESULT = out;
