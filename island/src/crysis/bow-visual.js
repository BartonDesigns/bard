// A single geometric source for the held arrow, projectile, string and drawing hand.
// Metres in item space: +X forward, +Y up, +Z right. The arrow rests beside the riser.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const BOW_DRAW = .28;
export const BOW_REST = new THREE.Vector3(.018, .056, -.025);
export const BOW_ARROW_LENGTH = .745;
const clamp = x => Math.max(0, Math.min(1, Number(x) || 0));
const smooth = x => x * x * (3 - 2 * x);
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(1, 0, 0);

// Match the shared kit shader without introducing another texture or material.
function surface(g, colour, roughness, metalness, tile = 0, wear = .06) {
  const p = g.attributes.position, n = p.count, c = new THREE.Color(colour);
  const colours = new Float32Array(n * 3), surf = new Float32Array(n * 4), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    colours.set([c.r, c.g, c.b], i * 3); surf.set([roughness, metalness, tile + wear / 2, 0], i * 4);
    uv.set([p.getX(i) * 65 + p.getZ(i) * 35, p.getY(i) * 65], i * 2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Shared geometry is deliberately immutable, allowing a projectile pool to reuse it.
export function createBowArrow(material, low = false) {
  const seg = low ? 5 : 10, parts = [];
  const shaft = new THREE.CylinderGeometry(.0031, .0031, .696, seg).rotateZ(-Math.PI / 2).translate(.348, 0, 0);
  parts.push(surface(shaft, 0x8d7448, .69, .03, 4));
  const collar = new THREE.CylinderGeometry(.0042, .0042, .024, seg).rotateZ(-Math.PI / 2).translate(.693, 0, 0);
  parts.push(surface(collar, 0x4c5558, .36, .78, 1));
  const tip = new THREE.ConeGeometry(.006, .04, low ? 4 : 8).rotateZ(-Math.PI / 2).translate(.725, 0, 0);
  parts.push(surface(tip, 0xa5acaf, .28, .84, 1));
  const notch = new THREE.CylinderGeometry(.004, .004, .013, seg).rotateZ(-Math.PI / 2).translate(.0065, 0, 0);
  parts.push(surface(notch, 0xddd0a1, .55, .03));
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape(); s.moveTo(.02, .002); s.lineTo(.035, .015); s.lineTo(.078, .014); s.lineTo(.092, .003); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: .0012, bevelEnabled: false, steps: 1 }).translate(0, 0, -.0006).rotateX(i * Math.PI * 2 / 3);
    parts.push(surface(g, i === 0 ? 0xb37c43 : 0xc9c0a0, .84, 0, 5));
  }
  // Extrusion is nonindexed, while the cylinders have indices.
  const list = parts.map(g => { const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose(); return flat; });
  const geometry = mergeGeometries(list); for (const g of list) g.dispose();
  geometry.computeBoundingSphere(); const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'nocked-arrow'; mesh.frustumCulled = false;
  return mesh;
}

function limb(material, sign, low, colour) {
  const segments = low ? 10 : 24, p = [], ix = [];
  for (let i = 0; i <= segments; i++) for (let j = 0; j < 4; j++) p.push(0, 0, 0);
  for (let i = 0; i < segments; i++) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4; ix.push(a, a + 4, b, b, a + 4, b + 4); }
  ix.push(0, 1, 2, 0, 2, 3); const end = segments * 4; ix.push(end, end + 2, end + 1, end, end + 3, end + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
  surface(g, colour, .54, .12, 4); const mesh = new THREE.Mesh(g, material); mesh.name = sign > 0 ? 'upper-limb' : 'lower-limb'; mesh.frustumCulled = false;
  const tip = new THREE.Vector3();
  function update(draw) {
    const pos = g.attributes.position;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, x = -.004 + .046 * Math.sin(t * Math.PI) - .026 * t - .11 * draw * t * t;
      const y = sign * (.19 + .47 * t - .053 * draw * t * t), w = .031 - .017 * t, thick = .009 - .004 * t;
      for (let j = 0; j < 4; j++) pos.setXYZ(i * 4 + j, x + (j < 2 ? -1 : 1) * thick / 2, y, (j === 0 || j === 3 ? -1 : 1) * w / 2);
      if (i === segments) tip.set(x, y, 0);
    }
    pos.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  update(0); return { mesh, tip, update };
}

export function createBowVisual(model, material, { low = false, colour = 0x4b5140 } = {}) {
  const group = new THREE.Group(); group.name = 'bow-flex'; model.add(group);
  const upper = limb(material, 1, low, colour), lower = limb(material, -1, low, colour); group.add(upper.mesh, lower.mesh);
  const stringGeometry = surface(new THREE.CylinderGeometry(.00115, .00115, 1, low ? 4 : 6), 0xd8d1bb, .88, 0);
  const strings = [new THREE.Mesh(stringGeometry, material), new THREE.Mesh(stringGeometry, material)];
  strings.forEach((m, i) => { m.name = 'bowstring-' + i; m.frustumCulled = false; group.add(m); });
  const serving = new THREE.Mesh(surface(new THREE.CylinderGeometry(.0021, .0021, .055, low ? 4 : 8), 0x373833, .89, 0), material); serving.name = 'string-serving'; group.add(serving);
  const arrow = createBowArrow(material, low); group.add(arrow);
  const state = { draw: 0, loaded: true, nock: 1 }, nock = new THREE.Vector3(), hand = new THREE.Vector3(), tip = new THREE.Vector3(), direction = new THREE.Vector3();
  const right = new THREE.Matrix4(), a = new THREE.Vector3(.12, 0, -1).normalize(), t = UP.clone(), n = new THREE.Vector3().crossVectors(t, a);
  let visibleDraw = 0, releaseTime = 0, releaseDraw = 0, currentNock = 1;
  function set(next = {}) { if ('draw' in next) state.draw = clamp(next.draw); if ('loaded' in next) state.loaded = !!next.loaded; if ('nock' in next) state.nock = clamp(next.nock); }
  function fire() { releaseTime = .19; releaseDraw = visibleDraw; state.draw = 0; state.loaded = false; state.nock = 0; }
  function cancel() { state.draw = 0; releaseTime = 0; }
  function step(dt = 1 / 60) {
    dt = Math.max(0, Math.min(.1, dt));
    if (releaseTime > 0) { releaseTime = Math.max(0, releaseTime - dt); const u = 1 - releaseTime / .19; visibleDraw = releaseDraw * Math.exp(-u * 19) + Math.sin(u * Math.PI * 5) * .022 * (1 - u); }
    else visibleDraw += (state.draw - visibleDraw) * (1 - Math.exp(-dt * 30));
    const bend = Math.max(0, visibleDraw); upper.update(bend); lower.update(bend);
    nock.set(-.14 - BOW_DRAW * visibleDraw, BOW_REST.y, BOW_REST.z);
    [upper, lower].forEach((part, i) => {
      const d = part.tip.clone().sub(nock), mesh = strings[i]; mesh.position.copy(nock).add(part.tip).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(UP, d.clone().normalize()); mesh.scale.set(1, d.length(), 1);
    });
    serving.position.copy(nock);
    currentNock = state.loaded ? 1 : state.nock;
    const travel = 1 - smooth(currentNock);
    const nockAt = nock.clone().add(new THREE.Vector3(-.13 * travel, -.28 * travel, .16 * travel));
    direction.subVectors(BOW_REST, nock).normalize(); arrow.position.copy(nockAt); arrow.quaternion.setFromUnitVectors(FORWARD, direction);
    arrow.visible = state.loaded || (currentNock > .08 && currentNock < 1);
    tip.copy(direction).multiplyScalar(BOW_ARROW_LENGTH).add(nock);
    hand.copy(nockAt).add(new THREE.Vector3(.026, -.012, .028));
    if (releaseTime > 0) { const u = 1 - releaseTime / .19; hand.set(-.14 - BOW_DRAW * releaseDraw - .024 * Math.sin(u * Math.PI), BOW_REST.y - .012, BOW_REST.z + .028 + .025 * Math.sin(u * Math.PI)); }
    right.makeBasis(a, t, n).setPosition(hand);
  }
  function info() {
    let stringNockError = 0, stringTipError = 0;
    [upper, lower].forEach((part, i) => { const mesh = strings[i]; mesh.updateMatrix(); stringNockError = Math.max(stringNockError, new THREE.Vector3(0, -.5, 0).applyMatrix4(mesh.matrix).distanceTo(nock)); stringTipError = Math.max(stringTipError, new THREE.Vector3(0, .5, 0).applyMatrix4(mesh.matrix).distanceTo(part.tip)); });
    const projected = BOW_REST.clone().sub(nock).cross(direction).length();
    return { draw: state.draw, visibleDraw, drawMeters: BOW_DRAW * Math.max(0, visibleDraw), loaded: state.loaded, nock: nock.toArray(), arrowNock: arrow.position.toArray(), rest: BOW_REST.toArray(), stringTips: [upper.tip.toArray(), lower.tip.toArray()], rightPalmTarget: hand.toArray(), arrowVisible: arrow.visible, nockProgress: currentNock, stringNockErrorMm: stringNockError * 1000, stringTipErrorMm: stringTipError * 1000, arrowRestErrorMm: projected * 1000 };
  }
  step(0); return { set, fire, cancel, step, info, right, tip, direction, arrow, group, state, dispose() { group.traverse(o => { if (o.geometry && o.geometry !== stringGeometry) o.geometry.dispose(); }); stringGeometry.dispose(); group.removeFromParent(); } };
}
