// Standalone WebGL fixture for the production orbital material.
import * as THREE from 'three';
import { createOrbitView, ORBIT_FRAGMENT } from '../src/space/view.js';
import { planetProfile } from '../src/planet/profile.js';
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(640, 420); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const compiled = [], compile = renderer.compile.bind(renderer);
renderer.compile = (scene, camera) => { compiled.push({ scene, camera }); return compile(scene, camera); };
let view, pass;
window.vista = {
 async render({ type = 'TERRAN', phone = false, near = false, earth = false, before = null, airless = false, time = 1000 } = {}) {
  view?.dispose(); compiled.length = 0;
  const profile = { ...planetProfile(type, 1337), ...(airless ? { airless: true } : {}) };
  view = createOrbitView({ renderer, earth, seed: 1337, radius: 6371000, profile, shared: {}, companion: { radius: 1737400, kind: 'moon' } });
  pass = compiled[0];
  const u = view.uniforms;
  u.uBlend.value = 1; u.uAspect.value = 640 / 420; u.uTan.value = Math.tan(Math.PI / 6);
  u.uHome.value.set(0, 0, -17000); u.uMoon.value.set(0, 0, 100000);
  u.uSun.value.set(.8, .2, 1).normalize(); u.uCamera.value.identity();
  u.uGeography.value.identity(); u.uStars.value.identity(); u.uDetail.value = phone ? 0 : 1;
  u.uTime.value = time;
  if (near) { u.uHome.value.set(0, -6621, 0); u.uCamera.value.setFromMatrix4(new THREE.Matrix4().makeRotationX(-.32)); }
  const mat = pass.scene.children[0].material;
  mat.fragmentShader = before || ORBIT_FRAGMENT; mat.needsUpdate = true;
  if (earth) for (let n = 0; n < 100 && !u.uMapReady.value; n++) await new Promise(r => setTimeout(r, 25));
  const t = performance.now(); renderer.render(pass.scene, pass.camera); renderer.getContext().finish();
  const ms = performance.now() - t;
  const gl = renderer.getContext(), pixels = new Uint8Array(640 * 420 * 4);
  gl.readPixels(0, 0, 640, 420, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let sum = 0, bright = 0; for (let i = 0; i < pixels.length; i += 4) { sum += pixels[i] + pixels[i+1] + pixels[i+2]; if (pixels[i]+pixels[i+1]+pixels[i+2] > 40) bright++; }
  return { type, phone, near, earth, airless, sum, bright, ms, glError: gl.getError(), mapReady: u.uMapReady.value,
   shaderOK: renderer.info.programs.every(p => p.diagnostics?.runnable !== false), textures: renderer.info.memory.textures, calls: renderer.info.render.calls };
 },
 dispose() { view?.dispose(); renderer.dispose(); }
};
