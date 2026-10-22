// Sounds placed in the world, in three dimensions. Each one goes out through a PannerNode: head-
// related transfer on a computer, so a growl behind you is behind you and a wail from the sky
// is above, and the cheaper equal-power panning on a phone; the level falls off with distance
// the way the inverse law has it. The listener is the camera, told where it is and which way
// it faces every frame (combat/combat.js update). Whoever plays a sound at a place in the world
// goes through here: the creatures and the bosses (creatures/voice.js), and the magic's own
// sounds (magic/fx.js) when they come to it.
//
//   listen(camera)                  each frame: the listener where the camera is, facing its way
//   placed(ctx, out, at, { ref, roll, max })
//                                   a panner at `at` wired into out: { node, move(p), stop() }.
//                                   ref is the distance (m) at which the sound is at its full
//                                   level, falling as ref / d beyond it (roll steepens or
//                                   softens that: 1 is the inverse law, less carries further)
//   SPATIAL_MODEL                   the panning in use ('HRTF' or 'equalpower')

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';
import { PHONE_DEVICE } from '../world/device.js';

export const SPATIAL_MODEL = PHONE_DEVICE ? 'equalpower' : 'HRTF';

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion();
// (a jump in a listener's or a source's place clicks: every move is a short glide)
const GLIDE = 0.03;
function setParam(param, v, t) {
	if (!param) return false;
	param.setTargetAtTime(v, t, GLIDE);
	return true;
}
let lastCtx = null, lastAt = -1;
export function listen(camera, ctx = soundBus()?.ctx) {
	if (!ctx || !camera) return;
	const L = ctx.listener;
	if (!L) return;
	camera.getWorldPosition(_p);
	camera.getWorldDirection(_f);
	_u.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(_q));
	const t = ctx.currentTime;
	// (a fresh context, or one left a while: straight there, no glide from wherever it was)
	const fresh = ctx !== lastCtx || t - lastAt > 1;
	lastCtx = ctx; lastAt = t;
	if (L.positionX && !fresh) {
		setParam(L.positionX, _p.x, t); setParam(L.positionY, _p.y, t); setParam(L.positionZ, _p.z, t);
		setParam(L.forwardX, _f.x, t); setParam(L.forwardY, _f.y, t); setParam(L.forwardZ, _f.z, t);
		setParam(L.upX, _u.x, t); setParam(L.upY, _u.y, t); setParam(L.upZ, _u.z, t);
	} else if (L.positionX) {
		L.positionX.value = _p.x; L.positionY.value = _p.y; L.positionZ.value = _p.z;
		L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z;
		L.upX.value = _u.x; L.upY.value = _u.y; L.upZ.value = _u.z;
	} else {
		L.setPosition(_p.x, _p.y, _p.z);
		L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
	}
}

export function placed(ctx, out, at, { ref = 4, roll = 1, max = 4000 } = {}) {
	const p = ctx.createPanner();
	p.panningModel = SPATIAL_MODEL;
	p.distanceModel = 'inverse';
	p.refDistance = Math.max(0.1, ref);
	p.rolloffFactor = roll;
	p.maxDistance = max;
	let first = true;
	function move(q) {
		const x = q.x || 0, y = q.y || 0, z = q.z || 0;
		if (p.positionX) {
			if (first) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
			else { const t = ctx.currentTime; setParam(p.positionX, x, t); setParam(p.positionY, y, t); setParam(p.positionZ, z, t); }
		} else p.setPosition(x, y, z);
		first = false;
	}
	move(at);
	p.connect(out);
	return { node: p, move, stop() { try { p.disconnect(); } catch { /* already gone */ } } };
}
