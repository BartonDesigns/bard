// Striking the singing stones: the cave alcoves' choruses, the Deep Gate's ring, the deep's
// own alcoves and the boulders that bob with the music. One prompt for all of them: look at
// a stone within reach and it glows, with a Strike button (or E); a click or a tap on it
// strikes too. Each strike rings a note in the faceplate's key on its own lead (the dev page
// has a small bell of its own) and a ripple runs out over the ground from the stone.

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';
import { strikePulse } from '../pulse.js';

// the key the Bard is in: its root and scale, or C major
export function harmony() {
	const st = window.autoSynth?.state?.() || window.L99Continuity?.harmony?.();
	const iv = Array.isArray(st?.intervals) ? st.intervals : Array.isArray(st?.scale) ? st.scale : [0, 2, 4, 5, 7, 9, 11, 12];
	const steps = iv.filter((v, i) => i === 0 || v < 12);
	return { root: Number.isFinite(st?.root) ? st.root : 0, steps: steps.length ? steps : [0, 2, 4, 5, 7, 9, 11] };
}
// a scale degree (0 = the root, 7 = the octave in a seven-note scale) in semitones
export function semitone(degree) {
	const { steps } = harmony(), n = steps.length, d = Math.round(degree);
	return steps[((d % n) + n) % n] + 12 * Math.floor(d / n);
}

let serial = 0;
const live = new Map();
// ring one note: degree in the faceplate's scale, how hard, how long it sings
export function ring(degree, { vel = 0.55, dur = 1.8, bell = false } = {}) {
	const semi = semitone(degree);
	if (typeof window.playLead === 'function' && typeof window.stopLead === 'function') {
		const id = 'stone:' + (++serial);
		try { window.playLead(id, semi, 1, true, Math.max(0.05, Math.min(0.9, vel))); } catch { return false; }
		live.set(id, setTimeout(() => { live.delete(id); try { window.stopLead(id); } catch { /* the faceplate may be gone */ } }, dur * 1000));
		if (!bell) return true;
	}
	// the dev page, or a bell under the lead: struck stone, a few inharmonic partials
	const S = soundBus();
	if (!S) return false;
	const ctx = S.ctx, t = ctx.currentTime, f = 261.63 * Math.pow(2, (harmony().root + semi) / 12);
	const out = ctx.createGain();
	out.gain.value = vel * (bell && typeof window.playLead === 'function' ? 0.08 : 0.22);
	out.connect(S.out);
	for (const [m, a, d] of [[1, 1, dur], [2.76, 0.35, dur * 0.5], [5.4, 0.18, dur * 0.25], [0.5, 0.25, dur * 0.8]]) {
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.type = 'sine'; o.frequency.value = f * m;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
		o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
	}
	return true;
}
// a wrong note: a dull knock
export function knock() {
	const S = soundBus();
	if (!S) return;
	const ctx = S.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
	o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
	g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
	o.connect(g).connect(S.out); o.start(t); o.stop(t + 0.35);
}
// a phrase: degrees one after another (a restored alcove's answer, the gate's call)
export function phrase(degrees, gap = 0.22, opts = {}) {
	degrees.forEach((d, i) => setTimeout(() => ring(d, opts), i * gap * 1000));
}

// ---------- ripples: rings of light running out over the ground ----------
const ringGeo = new THREE.RingGeometry(0.86, 1, 40, 1);
ringGeo.rotateX(-Math.PI / 2);
export function createRipples(parent, max = 8) {
	const pool = [];
	for (let i = 0; i < max; i++) {
		const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
		m.visible = false; m.frustumCulled = false; m.renderOrder = 3;
		parent.add(m); pool.push({ m, t: 1, life: 1, size: 1 });
	}
	let next = 0;
	return {
		spawn(pos, color, size = 6, life = 1.4) {
			const r = pool[next++ % pool.length];
			r.m.position.copy(pos); r.m.material.color.set(color); r.t = 0; r.life = life; r.size = size; r.m.visible = true;
		},
		update(dt) {
			for (const r of pool) {
				if (!r.m.visible) continue;
				r.t += dt / r.life;
				if (r.t >= 1) { r.m.visible = false; continue; }
				const s = 0.3 + r.size * Math.sqrt(r.t);
				r.m.scale.set(s, 1, s);
				r.m.material.opacity = (1 - r.t) * 0.85;
			}
		},
		dispose() { for (const r of pool) { parent.remove(r.m); r.m.material.dispose(); } },
	};
}
// the shared ripple of a struck surface (pulse.js), for materials that take it
export function pulseAt(point, color, reach, now) { strikePulse(point, null, reach, color, now); }

// ---------- the prompt ----------
// providers: functions returning targets { pos (world Vector3), r, label, icon, act(point), mesh? }
export function createStriker({ camera, mount, button, isPhone, canvas, shared }) {
	const providers = [];
	const btn = button('🔔 Strike', 'Strike the stone (E)', 'display:none;', 'prompt 58');
	mount.appendChild(btn);
	for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (e) => e.stopPropagation());
	// the glow round the stone you are looking at
	const focus = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 40), new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
	focus.visible = false; focus.renderOrder = 9; focus.frustumCulled = false;
	let scene = null, current = null, scanT = 0, pulse = 0;
	const fwd = new THREE.Vector3(), to = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
	function gather() {
		const out = [];
		for (const p of providers) { try { const t = p(); if (t) for (const x of t) out.push(x); } catch { /* a world going away */ } }
		return out;
	}
	function pick() {
		camera.getWorldDirection(fwd);
		let best = null, score = -1;
		for (const t of gather()) {
			to.subVectors(t.pos, camera.position);
			const d = to.length(), reach = (t.reach ?? 3.6) + (t.r || 0.5);
			if (d > reach || d < 1e-3) continue;
			// generous on a phone: you need not aim, only face it
			const c = to.dot(fwd) / d, need = isPhone ? 0.55 : 0.8;
			if (c < need) continue;
			const s = c - d * 0.04;
			if (s > score) { score = s; best = t; }
		}
		return best;
	}
	function strike(t, point) {
		if (!t) return false;
		pulse = 1;
		t.act(point || t.pos);
		return true;
	}
	btn.addEventListener('click', (e) => { e.stopPropagation(); strike(current); });
	addEventListener('keydown', (e) => {
		if ((e.key === 'e' || e.key === 'E') && !e.repeat && current && btn.style.display !== 'none' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); e.stopImmediatePropagation(); strike(current); }
	}, true);
	// a click or a tap on a stone (not a drag to look)
	let down = null;
	addEventListener('pointerdown', (e) => { if (e.target === canvas) down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
	addEventListener('pointerup', (e) => {
		if (!down || e.target !== canvas) { down = null; return; }
		const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
		down = null;
		if (moved > 10 || held > 450) return;
		const meshes = [], byMesh = new Map();
		for (const t of gather()) if (t.mesh && t.mesh.visible !== false && camera.position.distanceTo(t.pos) < (t.reach ?? 3.6) + 6) { meshes.push(t.mesh); byMesh.set(t.mesh, t); }
		if (!meshes.length) return;
		const r = canvas.getBoundingClientRect();
		if (document.pointerLockElement) ndc.set(0, 0); else ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
		ray.setFromCamera(ndc, camera);
		const hit = ray.intersectObjects(meshes, false)[0];
		if (hit) strike(byMesh.get(hit.object), hit.point);
	}, true);
	return {
		add(fn) { providers.push(fn); },
		strike,
		current: () => current,
		update(dt, sceneNow, on = true) {
			if (sceneNow && sceneNow !== scene) { scene?.remove(focus); scene = sceneNow; scene.add(focus); }
			scanT -= dt;
			if (scanT <= 0) {
				scanT = 0.12;
				current = on ? pick() : null;
				const show = current ? '' : 'none';
				if (btn.style.display !== show) btn.style.display = show;
				if (current) {
					const text = `${current.icon || '🔔'} ${current.label || 'Strike'}${isPhone ? '' : ' (E)'}`;
					if (btn.textContent !== text) { btn.textContent = text; btn.title = current.label || 'Strike'; btn.setAttribute('aria-label', btn.title); }
				}
			}
			focus.visible = !!current;
			if (current) {
				pulse *= Math.exp(-dt * 4);
				const s = (current.r || 0.5) * (1.05 + 0.06 * Math.sin((shared?.uTime?.value || 0) * 5)) + pulse * 0.4;
				focus.position.copy(current.pos);
				focus.quaternion.copy(camera.quaternion);
				focus.scale.setScalar(s);
				focus.material.color.set(current.color ?? 0xbff6ff);
				focus.material.opacity = 0.35 + pulse * 0.5;
			}
		},
	};
}
