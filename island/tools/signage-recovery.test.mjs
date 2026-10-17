import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setTier } from '../src/world/governor.js';
import { signMaterial, currentSignMaterial, clearMaterials, syncSignageMaterials, recentSignageRecovery, recoverSignage, SIGNAGE_RECOVERY_KEY } from '../src/signage/materials.js';
import { createGraphicsRecovery } from '../src/world/graphics-recovery.js';

test('minimal signs use a compact shader while keeping atlas and headlights', () => {
	const map = new THREE.Texture(); setTier(0);
	const full = signMaterial('retro', 3, map); assert.equal(full.isMeshStandardMaterial, true);
	setTier(3); const light = signMaterial('retro', 3, map);
	assert.equal(light.isShaderMaterial, true); assert.equal(light.lights, false);
	assert.equal(light.uniforms.map.value, map); assert.equal(light.depthWrite, false);
	assert.equal(light.side, THREE.DoubleSide); assert.equal(light.forceSinglePass, true);
	assert.match(light.fragmentShader, /uSgHead/); assert.match(light.fragmentShader, /gl_FrontFacing/);
	assert.match(light.fragmentShader, /fog_fragment/); assert.match(light.fragmentShader, /tonemapping_fragment/);
	assert.doesNotMatch(light.fragmentShader, /uCivicMetal|uCivicEnamel|lights_physical|shadowmap|roughnessFactor/);
	assert.ok(light.vertexShader.length + light.fragmentShader.length < 8000);
	clearMaterials(); setTier(0);
});

test('quality changes replace existing signs and hidden vehicle decals, preserving geometry and artwork', () => {
	setTier(0); const scene = new THREE.Scene(), map = new THREE.Texture();
	const full = signMaterial('retro', 3, map), normal = new THREE.MeshStandardMaterial();
	const a = new THREE.Mesh(new THREE.PlaneGeometry(), full), b = new THREE.Mesh(a.geometry, [full, normal]); b.visible = false;
	scene.add(a, b); let disposed = 0; full.addEventListener('dispose', () => disposed++);
	setTier(2); assert.equal(syncSignageMaterials(scene), 2); assert.equal(disposed, 1);
	assert.equal(a.material, b.material[0]); assert.equal(b.material[1], normal);
	assert.equal(currentSignMaterial(full), a.material, 'a cached vehicle template also selects the current shader');
	assert.equal(a.material.map, map); assert.equal(a.geometry, b.geometry);
	assert.equal(syncSignageMaterials(scene), 0);
	setTier(0); syncSignageMaterials(scene); assert.equal(a.material.isMeshStandardMaterial, true);
	assert.notEqual(a.material, full, 'disposed material is not returned from the cache'); clearMaterials();
});

test('repeated resets block rendering until reload, while isolated losses can recover', () => {
	let at = 1000; const r = createGraphicsRecovery({ now: () => at });
	assert.equal(r.lost(), false); at += 60001; assert.equal(r.lost(), false);
	at += 100; assert.equal(r.lost(), true); at += 120000; assert.equal(r.blocked(), true);
	assert.equal(createGraphicsRecovery().blocked(), false);
});

test('a signage failure persists a temporary compact path even with High selected', () => {
	const values = new Map(), store = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
	values.set(SIGNAGE_RECOVERY_KEY, '1000'); assert.equal(recentSignageRecovery(store, 1001), true);
	assert.equal(recentSignageRecovery(store, 1000 + 3 * 86400000), false);
	assert.equal(recentSignageRecovery({ getItem() { throw Error('denied'); } }), false);
	recoverSignage(store); setTier(0);
	assert.equal(signMaterial('retro', 3, new THREE.Texture()).isShaderMaterial, true);
	assert.equal(recentSignageRecovery(store), true); clearMaterials();
});
