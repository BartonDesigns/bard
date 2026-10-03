import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { captureResources } from '../src/world/resources.js';
import { usePhoto } from '../src/world/photomats.js';
import { createShaderWarm } from '../src/world/shaderwarm.js';

const counts = (objects) => {
  const n = new Map();
  for (const o of objects) { n.set(o, 0); o.addEventListener('dispose', () => n.set(o, n.get(o) + 1)); }
  return n;
};

test('world cleanup releases removed objects, hidden textures, instances and shadows once', () => {
  const scene = new THREE.Scene(), map = new THREE.Texture(), keep = new THREE.Texture();
  const target = new THREE.WebGLRenderTarget(4, 4);
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.ShaderMaterial({ uniforms: { map: { value: map }, nested: { value: [{ atlas: map }, keep, target.texture] } } });
  const depth = new THREE.MeshDepthMaterial({ map });
  const mesh = new THREE.InstancedMesh(geometry, material, 2);mesh.customDepthMaterial = depth;
  const other = new THREE.Mesh(geometry, material);
  const light = new THREE.DirectionalLight();light.shadow.map = target;
  scene.add(mesh, other, light);
  const n = counts([map, keep, geometry, material, depth, mesh, target]);
  const release = captureResources(scene, { keepTextures: [keep] });
  scene.clear(); // the world's own teardown can remove objects first
  release();release();
  for (const o of [map, geometry, material, depth, mesh, target]) assert.equal(n.get(o), 1);
  assert.equal(n.get(keep), 0);
});

test('shared skeletons and uniforms-only island maps are released', () => {
  const scene = new THREE.Scene(), bone = new THREE.Bone(), skeleton = new THREE.Skeleton([bone]);
  skeleton.computeBoneTexture();
  const texture = skeleton.boneTexture, height = new THREE.DataTexture(new Float32Array(4), 2, 2);
  const n = counts([texture, height]);
  for (let i = 0; i < 2; i++) { const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());mesh.skeleton = skeleton;scene.add(mesh); }
  captureResources(scene, { textures: [height] })();
  assert.equal(n.get(texture), 1);assert.equal(n.get(height), 1);
  assert.equal(skeleton.boneTexture, null);
});

test('textures injected during shader compilation and reflection sources are evicted', () => {
  const scene = new THREE.Scene(), injected = new THREE.Texture(), rt = new THREE.WebGLRenderTarget(2, 2);
  const m = new THREE.MeshStandardMaterial({ envMap: rt.texture });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  const n = counts([injected, rt.texture]);
  const renderer = { properties: { get: () => ({ uniforms: { detail: { value: injected } } }) } };
  captureResources(scene, { renderer, materials: [m, false, { colour: 'paint' }] })();
  assert.equal(n.get(injected), 1);assert.equal(n.get(rt.texture), 1);
  rt.dispose();
});

test('world replacement cancels asynchronous shader warming and clears pending old objects', async () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  for (let i = 0; i < 4; i++) scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const compiled = [];
  const renderer = { getContext: () => ({ isContextLost: () => false }), compile: (batch) => compiled.push([...batch.children]) };
  const warm = createShaderWarm(renderer, scene, camera);
  const job = warm.all({ n: 1 });
  assert.equal(compiled.length, 1);
  warm.reset();scene.clear();await job;warm.tick(1);
  assert.equal(compiled.length, 1);
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());scene.add(fresh);
  warm.tick(1);assert.equal(compiled.length, 2);assert.deepEqual(compiled[1], [fresh]);
  // Work deferred by the time budget must also die with the old world.
  warm.reset();await warm.all({ budget: -1 });warm.reset();scene.clear();warm.tick(1);
  assert.equal(compiled.length, 2);
});


test('late photographic upgrades cannot resurrect disposed materials; retired maps remain owned', async () => {
  const original = { Image: globalThis.Image, document: globalThis.document };
  let im;
  globalThis.Image = class { constructor() { this.width = this.height = 64; im = this; } set src(value) { this.url = value; } };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, putImageData() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }) };
  try {
    const fallback = new THREE.Texture(), dead = new THREE.MeshStandardMaterial({ map: fallback });
    const choices = [['brass', 1, { size: 8, normal: 1 }]];
    const pending = usePhoto(dead, choices);
    dead.dispose();im.onload();
    assert.equal(await pending, null);assert.equal(dead.map, fallback);
    const alive = new THREE.MeshStandardMaterial({ map: fallback });
    assert.equal(await usePhoto(alive, choices), 'brass');
    assert.notEqual(alive.map, fallback);assert.ok(alive.userData.photoFallbacks.includes(fallback));
    const n = counts([fallback, alive.map, alive.normalMap]);
    captureResources(new THREE.Scene(), { materials: [alive] })();
    for (const value of n.values()) assert.equal(value, 1);
  } finally { Object.assign(globalThis, original); }
});
