import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BOW_DRAW, BOW_ARROW_LENGTH, createBowArrow, createBowVisual } from '../src/crysis/bow-visual.js';

for (const low of [false, true]) test(`bow geometry and release, ${low ? 'phone' : 'desktop'}`, () => {
  const material = new THREE.MeshStandardMaterial(), model = new THREE.Group();
  const bow = createBowVisual(model, material, { low });
  for (const draw of [0, .25, .5, 1]) {
    bow.set({ draw, loaded: true, nock: 1 });
    for (let i = 0; i < 90; i++) bow.step(1 / 60);
    const info = bow.info();
    assert.ok(Math.abs(info.drawMeters - BOW_DRAW * draw) < .0001);
    assert.ok(info.stringNockErrorMm < .01 && info.stringTipErrorMm < .01 && info.arrowRestErrorMm < .01);
    assert.equal(info.arrowVisible, true);
    model.traverse(object => {
      if (object.geometry) for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    });
  }
  const anchor = bow.info().rightPalmTarget[0];
  bow.fire(); bow.step(1 / 60);
  assert.equal(bow.info().arrowVisible, false);
  assert.ok(Math.abs(bow.info().rightPalmTarget[0] - anchor) < .04, 'release hand stays near cheek while string springs forward');
  bow.set({ draw: 0, loaded: false, nock: .5 });
  for (let i = 0; i < 30; i++) bow.step(1 / 60);
  assert.equal(bow.info().arrowVisible, true, 'replacement arrow appears during nocking');
  bow.set({ draw: 1, loaded: true, nock: 1 });
  for (let i = 0; i < 30; i++) bow.step(1 / 60);
  bow.cancel(); for (let i = 0; i < 45; i++) bow.step(1 / 60);
  assert.ok(bow.info().drawMeters < .001, 'cancel lets down without losing loaded arrow');
  assert.equal(bow.info().arrowVisible, true);
  const arrow = createBowArrow(material, low); arrow.geometry.computeBoundingBox();
  assert.ok(Math.abs(arrow.geometry.boundingBox.max.x - BOW_ARROW_LENGTH) < .00001);
  arrow.geometry.dispose(); bow.dispose(); material.dispose();
});
