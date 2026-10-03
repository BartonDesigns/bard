import * as THREE from 'three';
import { createKineticModel, createKineticVoices } from './kinetic-model.js';
import { createKineticView } from './kinetic-view.js';

// One opt-in rig per world. No DOM, keyboard hooks, audio contexts or hidden autoplay.
// Caller owns placement and controls; clear on planet replacement, silence on hide/orbit.
// All ten authored silhouettes share a bounded local simulation and pooled geometry.
// Budget: one rig, 8 voices, 24 notes/sec, 4-note bursts.
// Legacy faceplate routing preserves FX/scale/gain but cannot pan individual balls.
export function createKinetic({ scene, host = window }) {
	const voices = createKineticVoices(host), scratch = new THREE.Vector3();
	let group = null, model = null, view = null, disposed = false;
	let scaleMode = 'faceplate', root = 0, tokens = 4;
	function clear() {
		voices.silence(); model?.silence();
		if (group) {
			const geometries = new Set(), materials = new Set();
			group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [].concat(o.material || [])) materials.add(m); if (o.isInstancedMesh) o.dispose(); });
			for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
			group.removeFromParent();
		}
		group = model = view = null;
	}
	function spawn(options = {}) {
		if (disposed) return false;
		clear(); tokens = 4; model = createKineticModel(options); view = createKineticView(model); group = view.group;
		group.position.set(options.x || 0, options.y || 0, options.z || 0); group.rotation.y = options.yaw || 0;
		scene.add(group); group.updateMatrixWorld(true); configure(options); model.replay(); view.refresh(); return true;
	}
	function configure(options = {}) {
		model?.configure(options);
		if (options.scale === 'faceplate' || Number.isInteger(options.scale) && options.scale >= 0 && options.scale < 4) scaleMode = options.scale;
		if (Number.isFinite(options.root)) root = Math.max(-12, Math.min(12, options.root));
	}
	function update(dt, { listener = null } = {}) {
		if (!model?.running) return;
		tokens = Math.min(4, tokens + Math.max(0, Math.min(0.1, dt || 0)) * 24);
		model.update(dt, (b, velocity) => {
			if (tokens < 1) return;
			scratch.set(b.x, b.y, b.z); group.localToWorld(scratch);
			const distance = listener ? scratch.distanceTo(listener) : 0;
			if (distance < 120) { tokens--; voices.note(b.ring, velocity, { distance, scale: scaleMode, root }); }
		}); view.refresh();
	}
	return { spawn, clear, configure, update, replay() { if (model) { voices.silence(); tokens = 4; model.replay(); view.refresh(); } }, silence() { voices.silence(); model?.silence(); },
		state() { return { kind: model?.kind || null, running: !!model?.running, voices: voices.count, count: model?.count ?? model?.bodies.length ?? 0, scale: scaleMode, root, ...(model?.settings || {}) }; },
		dispose() { clear(); voices.dispose(); disposed = true; } };
}
