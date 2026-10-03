import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from '../island/node_modules/three/build/three.module.js';
import { createGalacticGargantua228, GARGANTUA228_FRAG } from '../runtime/gargantua228.mjs';

const root = new URL('../', import.meta.url);
test('packed flight uses the editable renderer and keeps the horizon entry', () => {
  const packed = fs.readFileSync(new URL('runtime/flight-179.js.gz', root));
  const flight = gunzipSync(packed).toString();
  const source = fs.readFileSync(new URL('runtime/gargantua228.mjs', root), 'utf8').replace(/^export /gm, '');
  assert.ok(flight.includes(source));
  assert.equal(flight.split('// BEGIN GARGANTUA228').length, 2);
  assert.ok(flight.includes('window._galacticBH = createGalacticGargantua228(THREE, 18000);'));
  assert.ok(flight.includes('!window._galacticBH.userData.gargantua228 && cockpitCamera && window._lensPass'));
  const hash = createHash('sha256').update(packed).digest('hex').slice(0, 12);
  const page = fs.readFileSync(new URL('index.html', root), 'utf8');
  const loads = page.match(/flight-179\.js\.gz(?:\?v=[0-9a-f]+)?/g);
  assert.ok(loads.length >= 2);
  assert.ok(loads.every(url => url.endsWith('?v=' + hash)));
  // A visual replacement must retain the existing navigation/entry system.
  assert.ok(flight.includes('function _makeAbyssalAccretion(rand, bhR)'));
  assert.ok(flight.includes('window._bhLandPos = cockpitCamera.position.clone();'));
});

test('flight camera and galaxy translations produce the same relative rays', () => {
  const bh = createGalacticGargantua228(THREE, 18000, { mobile: false });
  const camera = new THREE.PerspectiveCamera(60, 1.6, 1, 1e8);
  const scene = new THREE.Scene();scene.add(bh, camera);
  const mesh = bh.userData.gargBillboard, u = bh.userData.gargMat.uniforms;
  camera.position.set(20, 30, 500000);camera.lookAt(bh.position);scene.updateMatrixWorld(true);
  mesh.onBeforeRender(null, scene, camera);
  const relative = u.uCamPos.value.clone().sub(u.uCenter.value);
  const translation = new THREE.Vector3(380000, -130000, -560000);
  camera.position.add(translation);bh.position.add(translation);scene.updateMatrixWorld(true);
  mesh.onBeforeRender(null, scene, camera);
  assert.ok(u.uCamPos.value.clone().sub(u.uCenter.value).distanceTo(relative) < 1e-8);
  assert.deepEqual(u.uCameraWorld.value.elements, camera.matrixWorld.elements);
  assert.ok(Number.isFinite(u.uClipDepth.value) && Math.abs(u.uClipDepth.value) < 1);
  assert.equal(u.uRs.value, 18000);
  assert.equal(bh.userData.gargMat.fragmentShader, GARGANTUA228_FRAG);
  assert.equal(bh.userData.gargMat.premultipliedAlpha, true);
});

test('phones use the reference standard budget and world visibility hides the quad', () => {
  const phone = createGalacticGargantua228(THREE, 18000, { mobile: true });
  const desktop = createGalacticGargantua228(THREE, 18000, { mobile: false });
  assert.equal(phone.userData.gargMat.uniforms.uSteps.value, 200);
  assert.equal(desktop.userData.gargMat.uniforms.uSteps.value, 320);
  phone.visible = false;
  const visible = [];phone.traverseVisible(node => visible.push(node));
  assert.equal(visible.length, 0);
});
