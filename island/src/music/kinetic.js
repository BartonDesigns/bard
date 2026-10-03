import * as THREE from 'three';
import { createKineticModel, createKineticVoices } from './kinetic-model.js';

// One opt-in rig per world. No DOM, keyboard hooks, audio contexts or hidden autoplay.
// Caller owns placement and controls; clear on planet replacement, silence on hide/orbit.
// Budget: 192 (max 256) balls OR 15 pendulums, 8 voices, 24 notes/sec, 4-note bursts.
// Legacy faceplate routing preserves FX/scale/gain but cannot pan individual balls.
// Other eight legacy rig types, multiple simultaneous rigs and saved rigs remain unported.
export function createKinetic({ scene, host = window }) {
	const voices = createKineticVoices(host), matrix = new THREE.Matrix4(), color = new THREE.Color();
	const scratch = new THREE.Vector3(), origin = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
	const quat = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
	let group = null, model = null, balls = null, strings = null, disposed = false;
	let scaleMode = 'faceplate', root = 0, tokens = 4;
	function clear() {
		voices.silence(); model?.silence();
		if (group) {
			const geometries = new Set(), materials = new Set();
			group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [].concat(o.material || [])) materials.add(m); if (o.isInstancedMesh) o.dispose(); });
			for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
			group.removeFromParent();
		}
		group = model = balls = strings = null;
	}
	function refresh() {
		if (!model) return;
		for (let i = 0; i < model.bodies.length; i++) {
			const b = model.bodies[i]; matrix.makeTranslation(b.x, b.y, b.z); balls.setMatrixAt(i, matrix);
			if (strings) {
				scratch.set(0, b.y - 5.05, b.z); const len = scratch.length();
				quat.setFromUnitVectors(up, scratch.normalize()); scale.set(1, len, 1); origin.set(b.x, (5.05 + b.y) / 2, b.z / 2);
				matrix.compose(origin, quat, scale); strings.setMatrixAt(i, matrix);
			}
		}
		balls.instanceMatrix.needsUpdate = true; if (strings) strings.instanceMatrix.needsUpdate = true;
	}
	function spawn(options = {}) {
		if (disposed) return false;
		clear(); tokens = 4; model = createKineticModel(options); group = new THREE.Group();
		group.position.set(options.x || 0, options.y || 0, options.z || 0); group.rotation.y = options.yaw || 0;
		const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 });
		balls = new THREE.InstancedMesh(new THREE.SphereGeometry(model.kind === 'garden' ? 0.11 : 0.22, 8, 6), material, model.bodies.length);
		balls.frustumCulled = false; group.add(balls);
		for (let i = 0; i < model.bodies.length; i++) balls.setColorAt(i, color.setHSL(0.24 - model.bodies[i].ring / 24 * 0.1, 0.85, 0.55));
		const supportMat = new THREE.MeshStandardMaterial({ color: 0x5a2430, roughness: 0.8 });
		if (model.kind === 'garden') {
			const dais = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 0.6, 36), supportMat); dais.position.y = 0.3; group.add(dais);
		} else {
			const w = Math.max(6, model.bodies.length * 0.63);
			const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.3, 0.3), supportMat); beam.position.y = 5.2; group.add(beam);
			for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 7), supportMat); p.position.set(s * (w / 2 + 0.4), 2.6, 0); group.add(p); }
			strings = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), new THREE.MeshBasicMaterial({ color: 0x888888 }), model.bodies.length); strings.frustumCulled = false; group.add(strings);
		}
		scene.add(group); group.updateMatrixWorld(true); configure(options); model.replay(); model.update(1 / 120); refresh(); return true;
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
		}); refresh();
	}
	return { spawn, clear, configure, update, replay() { if (model) { voices.silence(); model.replay(); } }, silence() { voices.silence(); model?.silence(); },
		state() { return { kind: model?.kind || null, running: !!model?.running, voices: voices.count, count: model?.bodies.length || 0, scale: scaleMode, root, ...(model?.settings || {}) }; },
		dispose() { clear(); voices.dispose(); disposed = true; } };
}
